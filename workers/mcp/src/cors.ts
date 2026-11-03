const ALLOW_HEADERS = [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Protocol-Version",
    "mcp-session-id",
].join(", ");

const ALLOW_METHODS = "GET, POST, DELETE, OPTIONS";

/**
 * MCP clients include browser inspectors and desktop apps. Tokens travel in
 * Authorization (not cookies), so reflecting any Origin is acceptable.
 */
export function corsHeaders(request: Request): Headers {
    const headers = new Headers();
    const origin = request.headers.get("Origin");
    headers.set("Access-Control-Allow-Origin", origin ?? "*");
    headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
    headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
    headers.set(
        "Access-Control-Expose-Headers",
        "WWW-Authenticate, MCP-Session-Id"
    );
    headers.set("Access-Control-Max-Age", "86400");
    headers.set("Vary", "Origin");
    return headers;
}

export function withCors(response: Response, request: Request): Response {
    const headers = new Headers(response.headers);
    const cors = corsHeaders(request);
    for (const [key, value] of cors.entries()) {
        if (!headers.has(key)) headers.set(key, value);
    }
    return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
    });
}
