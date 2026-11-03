import type { McpEnv as McpEnvironment } from "./env.ts";
import type { UserSupabase } from "./supabase.ts";

import { authorizationServerUrl } from "./oauth.ts";

/** The caller as the Worker needs it — derived from verified JWT claims. */
export type McpUser = {
    email: null | string;
    id: string;
};

/**
 * Verify the bearer access token without a round-trip to Supabase Auth.
 *
 * `auth.getClaims` checks the signature against the project JWKS (ES256,
 * cached module-wide per isolate) and `exp`. It only falls back to a network
 * `getUser` call for legacy symmetric (HS256) tokens.
 *
 * Trade-off: a revoked session stays usable until its access token expires
 * (Supabase default: 1 hour). PostgREST verifies the same JWT the same way,
 * so this does not widen what a token can do.
 */
export async function verifyAccessToken(
    supabase: UserSupabase,
    token: string,
    environment: McpEnvironment
): Promise<McpUser | null> {
    let result: Awaited<ReturnType<UserSupabase["auth"]["getClaims"]>>;
    try {
        result = await supabase.auth.getClaims(token);
    } catch {
        return null;
    }
    const claims = result.data?.claims;
    if (result.error || !claims) return null;

    if (claims.iss !== authorizationServerUrl(environment)) return null;
    if (claims.role !== "authenticated") return null;
    if (typeof claims.sub !== "string" || claims.sub.length === 0) {
        return null;
    }

    return {
        email: typeof claims.email === "string" ? claims.email : null,
        id: claims.sub,
    };
}
