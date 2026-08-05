/**
 * Detect Supabase Auth redirect callback params in the current URL.
 * While these are present, `getSession()` may still be null (PKCE exchange
 * in flight) — boot must not finish as "logged out" until SIGNED_IN/OUT.
 */
export function isOAuthCallbackLocation(location: {
    hash: string;
    search: string;
}): boolean {
    const query = new URLSearchParams(location.search);
    if (
        query.has("code") ||
        query.has("error") ||
        query.has("error_description")
    ) {
        return true;
    }

    const rawHash = location.hash.startsWith("#")
        ? location.hash.slice(1)
        : location.hash;
    if (!rawHash) return false;

    const hash = new URLSearchParams(rawHash);
    return (
        hash.has("access_token") ||
        hash.has("refresh_token") ||
        hash.has("error") ||
        hash.has("error_description")
    );
}

/**
 * Whether AuthProvider should leave the boot spinner.
 * OAuth callback + null session means exchange is still running.
 */
export function shouldFinishAuthBoot(input: {
    isOAuthCallback: boolean;
    session: null | { user?: unknown };
}): boolean {
    if (input.isOAuthCallback && !input.session?.user) {
        return false;
    }
    return true;
}
