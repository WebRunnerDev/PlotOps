export type OAuthCallbackError = {
    code: string;
    description: string;
};

/**
 * Detect Supabase Auth redirect callback params in the current URL.
 * While these are present, `getSession()` may still be null (PKCE exchange
 * in flight) — boot must not finish as "logged out" until SIGNED_IN/OUT.
 */
export function isOAuthCallbackLocation(location: {
    hash: string;
    search: string;
}): boolean {
    const parameters = readOAuthCallbackParameters(location);
    if (
        parameters.has("code") ||
        parameters.has("error") ||
        parameters.has("error_description")
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
 * Provider or GoTrue error returned on the OAuth redirect URL.
 */
export function parseOAuthCallbackError(location: {
    hash: string;
    search: string;
}): null | OAuthCallbackError {
    const parameters = readOAuthCallbackParameters(location);
    const code = parameters.get("error");
    if (!code) return null;

    return {
        code,
        description: parameters.get("error_description")?.trim() || code,
    };
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

function readOAuthCallbackParameters(location: {
    hash: string;
    search: string;
}): URLSearchParams {
    const query = new URLSearchParams(location.search);
    if (
        query.has("code") ||
        query.has("error") ||
        query.has("error_description")
    ) {
        return query;
    }

    const rawHash = location.hash.startsWith("#")
        ? location.hash.slice(1)
        : location.hash;
    if (!rawHash) return query;

    return new URLSearchParams(rawHash);
}
