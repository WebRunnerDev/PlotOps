/**
 * GitHub `provider_token` only — Google (and other) OAuth sessions also carry
 * `provider_token`, which must never be stored as a GitHub API token.
 */
export function githubProviderTokenFromSession(
    session: null | {
        provider_token?: null | string;
        user?: { app_metadata?: { provider?: string } };
    }
): null | string {
    if (!session?.provider_token) return null;
    if (session.user?.app_metadata?.provider !== "github") return null;
    return session.provider_token;
}
