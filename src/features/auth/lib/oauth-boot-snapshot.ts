import {
    isOAuthCallbackLocation,
    type OAuthCallbackError,
    parseOAuthCallbackError,
} from "@/features/auth/lib/oauth-callback-url";

export type OAuthBootSnapshot = {
    error: null | OAuthCallbackError;
    isCallback: boolean;
};

function captureOAuthBootSnapshot(): OAuthBootSnapshot {
    if (globalThis.location === undefined) {
        return { error: null, isCallback: false };
    }

    const location = globalThis.location;
    return {
        error: parseOAuthCallbackError(location),
        isCallback: isOAuthCallbackLocation(location),
    };
}

/** Captured before Supabase strips `?code=` during PKCE exchange. */
export const oauthBootSnapshot = captureOAuthBootSnapshot();
