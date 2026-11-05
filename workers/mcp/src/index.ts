import type { McpEnv as McpEnvironment } from "./env.ts";

import { verifyAccessToken } from "./auth.ts";
import { corsHeaders, withCors } from "./cors.ts";
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
import {
    checkRateLimit,
    createSlidingWindowRateLimiter,
} from "./rate-limit.ts";
import { createUserClient } from "./supabase.ts";
import { TOOLS } from "./tools.ts";

/** Must match the `period` of the `[[ratelimits]]` bindings in wrangler.toml. */
const RATE_LIMIT_PERIOD_SECONDS = 60;

// Fallback only — used when the Cloudflare bindings are missing or error.
// Limits mirror wrangler.toml.
const ipFallback = createSlidingWindowRateLimiter({
    limit: 120,
    windowMs: RATE_LIMIT_PERIOD_SECONDS * 1000,
});
const userFallback = createSlidingWindowRateLimiter({
    limit: 60,
    windowMs: RATE_LIMIT_PERIOD_SECONDS * 1000,
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
        const ipAllowed = await checkRateLimit(
            environment.MCP_IP_LIMITER,
            ipFallback,
            `ip:${clientIp(request)}`
        );
        if (!ipAllowed) {
            return withCors(rateLimited(RATE_LIMIT_PERIOD_SECONDS), request);
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
        const user = await verifyAccessToken(supabase, token, environment);
        if (!user) {
            return withCors(
                unauthorizedResponse(request, environment),
                request
            );
        }

        const userAllowed = await checkRateLimit(
            environment.MCP_USER_LIMITER,
            userFallback,
            `user:${user.id}`
        );
        if (!userAllowed) {
            return withCors(rateLimited(RATE_LIMIT_PERIOD_SECONDS), request);
        }

        const body = await request.text();
        if (utf8ByteLength(body) > MAX_MCP_BODY_BYTES) {
            return withCors(json({ error: "payload_too_large" }, 413), request);
        }

        const clientId = readJwtClientId(token);
        const context = {
            clientId,
            supabase,
            user,
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
