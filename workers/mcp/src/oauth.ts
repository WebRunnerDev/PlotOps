import type { McpEnv as McpEnvironment } from "./env.ts";

export function authorizationServerUrl(environment: McpEnvironment): string {
    return `${environment.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`;
}

export function bearerToken(request: Request): null | string {
    const header = request.headers.get("Authorization");
    if (!header) return null;
    const match = /^Bearer\s+(\S+)/i.exec(header);
    return match?.[1] ?? null;
}

export function isMcpPath(pathname: string): boolean {
    return pathname === "/mcp" || pathname === "/mcp/";
}

export function isProtectedResourceMetadataPath(pathname: string): boolean {
    return (
        pathname === "/.well-known/oauth-protected-resource" ||
        pathname === "/.well-known/oauth-protected-resource/mcp" ||
        pathname === "/mcp/.well-known/oauth-protected-resource" ||
        pathname === "/oauth-protected-resource" ||
        pathname === "/mcp/oauth-protected-resource"
    );
}

export function mcpResourceUrl(
    request: Request,
    environment: McpEnvironment
): string {
    const configured = environment.MCP_RESOURCE_URL?.trim();
    if (configured) return configured.replace(/\/$/, "");
    return `${new URL(request.url).origin}/mcp`;
}

export function protectedResourceMetadata(
    request: Request,
    environment: McpEnvironment
) {
    const resource = mcpResourceUrl(request, environment);
    return {
        authorization_servers: [authorizationServerUrl(environment)],
        bearer_methods_supported: ["header"],
        resource,
        scopes_supported: ["openid", "email", "profile"],
    };
}

export function readJwtClientId(token: string): null | string {
    try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) return null;
        const json = atob(
            payloadPart.replaceAll("-", "+").replaceAll("_", "/")
        );
        const payload = JSON.parse(json) as { client_id?: unknown };
        return typeof payload.client_id === "string" ? payload.client_id : null;
    } catch {
        return null;
    }
}

export function unauthorizedResponse(
    request: Request,
    environment: McpEnvironment
): Response {
    const resource = mcpResourceUrl(request, environment);
    const metadata = `${new URL(request.url).origin}/.well-known/oauth-protected-resource`;
    return Response.json(
        {
            error: "unauthorized",
            error_description:
                "Sign in with your PlotOps account via OAuth 2.1.",
        },
        {
            headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": `Bearer resource_metadata="${metadata}", resource="${resource}"`,
            },
            status: 401,
        }
    );
}
