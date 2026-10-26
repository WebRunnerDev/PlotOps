/**
 * CORS allowlist for Edge Functions — never `*`.
 *
 * Allowed: the production SPA, any `http://localhost` / `http://127.0.0.1`
 * port (Vite dev + preview), and extra origins from the comma-separated
 * `CORS_ALLOWED_ORIGINS` secret (preview deploys). A request from any other
 * Origin gets no `Access-Control-Allow-*` headers, so the browser blocks it.
 */
export const PRODUCTION_APP_ORIGIN = "https://plotops.webrunner.dev";

const LOCALHOST_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export type CorsPolicy = {
    allowedOrigins: readonly string[];
    allowHeaders: string;
};

export function corsHeadersFor(
    origin: null | string,
    policy: CorsPolicy
): Record<string, string> {
    // Responses differ per Origin — keep shared caches from mixing them up.
    const headers: Record<string, string> = { Vary: "Origin" };
    if (!origin || !isAllowedOrigin(origin, policy.allowedOrigins)) {
        return headers;
    }
    return {
        ...headers,
        "Access-Control-Allow-Headers": policy.allowHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Max-Age": "600",
    };
}

export function isAllowedOrigin(
    origin: string,
    allowedOrigins: readonly string[]
): boolean {
    return LOCALHOST_ORIGIN.test(origin) || allowedOrigins.includes(origin);
}

/** Production origin plus normalized extras from `CORS_ALLOWED_ORIGINS`. */
export function parseAllowedOrigins(
    extra: null | string | undefined
): string[] {
    const origins = new Set([PRODUCTION_APP_ORIGIN]);
    for (const raw of (extra ?? "").split(",")) {
        const origin = normalizeOrigin(raw);
        if (origin) origins.add(origin);
    }
    return [...origins];
}

/** Preflight: 204 with CORS headers for allowed origins, bare 403 otherwise. */
export function preflightResponse(
    request: Request,
    policy: CorsPolicy
): Response {
    const headers = corsHeadersFor(request.headers.get("Origin"), policy);
    const allowed = "Access-Control-Allow-Origin" in headers;
    return new Response(null, { headers, status: allowed ? 204 : 403 });
}

function normalizeOrigin(raw: string): null | string {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "*") return null;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        return url.origin;
    } catch {
        return null;
    }
}
