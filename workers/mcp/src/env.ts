import type { RateLimitBinding } from "./rate-limit.ts";

export type McpEnv = {
    /** Cloudflare Rate Limiting binding keyed by client IP (wrangler.toml). */
    MCP_IP_LIMITER?: RateLimitBinding;
    MCP_RESOURCE_URL?: string;
    /** Cloudflare Rate Limiting binding keyed by user id (wrangler.toml). */
    MCP_USER_LIMITER?: RateLimitBinding;
    SUPABASE_PUBLISHABLE_KEY: string;
    SUPABASE_URL: string;
};
