export type McpEnv = {
    MCP_RATE_LIMIT?: string;
    MCP_RATE_WINDOW_SECONDS?: string;
    MCP_RESOURCE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY: string;
    SUPABASE_URL: string;
};

export function parsePositiveInt(
    raw: string | undefined,
    fallback: number
): number {
    const parsed = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return parsed;
}
