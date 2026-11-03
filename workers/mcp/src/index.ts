import type { McpEnv as McpEnvironment } from "./env.ts";

import { corsHeaders, withCors } from "./cors.ts";
import { parsePositiveInt } from "./env.ts";
import { MAX_MCP_BODY_BYTES, utf8ByteLength } from "./limits.ts";
import { acceptsMcp, handleMcpPost } from "./mcp.ts";
import {
    bearerToken,
    isMcpPath,
    isProtectedResourceMetadataPath,
    protectedResourceMetadata,
    readJwtClientId,
    unauthorizedResponse,
} from "./oauth.ts";
import { createSlidingWindowRateLimiter } from "./rate-limit.ts";
import { createUserClient } from "./supabase.ts";
import { TOOLS } from "./tools.ts";

const limiter = createSlidingWindowRateLimiter({
    limit: 120,
    windowMs: 60_000,
});

function clientIp(request: Request): string {
    return (
        request.headers.get("CF-Connecting-IP") ??
        request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

function json(data: unknown, status = 200): Response {
    return Response.json(data, { status });
}

async function logAction(
    supabase: ReturnType<typeof createUserClient>,
    input: {
        clientId: null | string;
        errorCode?: string;
        resourceId?: null | string;
        resourceType?: null | string;
        success: boolean;
        toolName: string;
    }
) {
    await supabase.rpc("log_mcp_action", {
        p_client_id: input.clientId,
        p_error_code: input.errorCode ?? null,
        p_resource_id: input.resourceId ?? null,
        p_resource_type: input.resourceType ?? null,
        p_success: input.success,
        p_tool_name: input.toolName,
    });
}

function rateLimited(retryAfterSec: number): Response {
    return Response.json(
        { error: "rate_limited" },
        {
            headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfterSec),
            },
            status: 429,
        }
    );
}

export default {
    async fetch(
        request: Request,
        environment: McpEnvironment
    ): Promise<Response> {
        if (
            !environment.SUPABASE_URL ||
            !environment.SUPABASE_PUBLISHABLE_KEY
        ) {
            return json({ error: "server_misconfigured" }, 500);
        }

        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: corsHeaders(request),
                status: 204,
            });
        }

        const url = new URL(request.url);
        const ipLimit = limiter.check(`ip:${clientIp(request)}`);
        if (!ipLimit.allowed) {
            return withCors(rateLimited(ipLimit.retryAfterSec), request);
        }

        if (isProtectedResourceMetadataPath(url.pathname)) {
            if (request.method !== "GET") {
                return withCors(
                    json({ error: "method_not_allowed" }, 405),
                    request
                );
            }
            return withCors(
                json(protectedResourceMetadata(request, environment)),
                request
            );
        }

        if (url.pathname === "/" && request.method === "GET") {
            return withCors(
                json({
                    mcp: "/mcp",
                    name: "plotops",
                    oauth: "/.well-known/oauth-protected-resource",
                }),
                request
            );
        }

        if (!isMcpPath(url.pathname)) {
            return withCors(json({ error: "not_found" }, 404), request);
        }

        if (request.method === "DELETE") {
            return withCors(new Response(null, { status: 204 }), request);
        }

        if (request.method === "GET") {
            return withCors(
                json({ error: "method_not_allowed" }, 405),
                request
            );
        }

        if (request.method !== "POST") {
            return withCors(
                json({ error: "method_not_allowed" }, 405),
                request
            );
        }

        if (!acceptsMcp(request)) {
            return withCors(json({ error: "not_acceptable" }, 406), request);
        }

        const token = bearerToken(request);
        if (!token) {
            return withCors(
                unauthorizedResponse(request, environment),
                request
            );
        }

        const supabase = createUserClient(environment, token);
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
            return withCors(
                unauthorizedResponse(request, environment),
                request
            );
        }

        const userLimit = limiter.check(`user:${data.user.id}`);
        if (!userLimit.allowed) {
            return withCors(rateLimited(userLimit.retryAfterSec), request);
        }

        const body = await request.text();
        if (utf8ByteLength(body) > MAX_MCP_BODY_BYTES) {
            return withCors(json({ error: "payload_too_large" }, 413), request);
        }

        const clientId = readJwtClientId(token);
        const rateLimit = parsePositiveInt(environment.MCP_RATE_LIMIT, 60);
        const windowSeconds = parsePositiveInt(
            environment.MCP_RATE_WINDOW_SECONDS,
            60
        );
        const allowed = await supabase.rpc("claim_mcp_rate_limit", {
            p_limit: rateLimit,
            p_window_seconds: windowSeconds,
        });
        if (allowed.error) {
            // Table missing until migrations apply — fail open for reads,
            // still enforce the in-memory window above.
        } else if (allowed.data === false) {
            return withCors(rateLimited(windowSeconds), request);
        }

        const context = {
            clientId,
            supabase,
            user: data.user,
        };

        // Wrap tools/call logging without parsing twice: handleMcpPost owns
        // JSON-RPC. Best-effort log after a successful parse of tools/call.
        let toolName: null | string = null;
        try {
            const parsed: unknown = JSON.parse(body);
            const message = Array.isArray(parsed) ? parsed[0] : parsed;
            if (
                message &&
                typeof message === "object" &&
                "method" in message &&
                message.method === "tools/call" &&
                "params" in message &&
                message.params &&
                typeof message.params === "object" &&
                "name" in message.params &&
                typeof message.params.name === "string"
            ) {
                toolName = message.params.name;
            }
        } catch {
            toolName = null;
        }

        const response = await handleMcpPost(body, context);

        if (toolName && TOOLS.some((tool) => tool.name === toolName)) {
            let success = response.ok;
            try {
                const clone = await response.clone().json();
                const result = (clone as { result?: { isError?: boolean } })
                    .result;
                if (result?.isError) success = false;
            } catch {
                success = false;
            }
            void logAction(supabase, {
                clientId,
                errorCode: success ? undefined : "tool_error",
                success,
                toolName,
            });
        }

        return withCors(response, request);
    },
};
