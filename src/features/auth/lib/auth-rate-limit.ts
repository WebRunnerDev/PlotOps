import type { AuthError } from "@supabase/supabase-js";

/** Client UX cooldown after GoTrue returns 429 — not a security control. */
export const AUTH_RATE_LIMIT_COOLDOWN_MS = 60_000;

export function isAuthRateLimited(error: AuthError): boolean {
    const code = error.code?.toLowerCase();
    return error.status === 429 || code === "over_request_rate_limit";
}
