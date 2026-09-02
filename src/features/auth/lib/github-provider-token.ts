/** GitHub OAuth access tokens use these prefixes (classic + fine-grained). */
const GITHUB_PROVIDER_TOKEN_PREFIX = /^(gh[opurs]_|github_pat_)/;

/**
 * GitHub `provider_token` only — Google (and other) OAuth sessions also carry
 * `provider_token`, which must never be stored as a GitHub API token.
 *
 * Supabase keeps the first signup provider in `app_metadata.provider`. When a
 * user signs up with Google and later signs in with GitHub (linked by email),
 * `provider` stays `"google"` but the session `provider_token` is GitHub's.
 */
export function githubProviderTokenFromSession(
    session: null | {
        provider_token?: null | string;
        user?: {
            app_metadata?: { provider?: string; providers?: string[] };
        };
    }
): null | string {
    const token = session?.provider_token;
    if (!token) return null;

    const appMetadata = session.user?.app_metadata;
    if (appMetadata?.provider === "github") return token;

    const providers = appMetadata?.providers;
    if (
        providers?.includes("github") &&
        GITHUB_PROVIDER_TOKEN_PREFIX.test(token)
    ) {
        return token;
    }

    return null;
}
