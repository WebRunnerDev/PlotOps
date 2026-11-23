import {
    isAuthApiError,
    isAuthSessionMissingError,
} from "@supabase/supabase-js";

/**
 * Auth API codes that mean the server no longer recognises this session, so
 * keeping the local copy would only leave the app signed in on paper.
 *
 * `bad_jwt` is deliberately absent: a skewed device clock (common right after
 * sleep) gets "token is expired" for a token that refreshes fine a moment later.
 */
const DEAD_SESSION_CODES: ReadonlySet<string> = new Set([
    "refresh_token_already_used",
    "refresh_token_not_found",
    "session_expired",
    "session_not_found",
    "user_banned",
    "user_not_found",
]);

/**
 * True only when an Auth error proves the session is gone.
 *
 * Everything else — offline after sleep (`AuthRetryableFetchError`), 5xx, 429,
 * or `AuthRefreshDiscardedError` when another tab rotated the refresh token
 * first — is transient. Signing out on those wipes the shared localStorage
 * entry and logs the user out of every open tab.
 */
export function isDeadSessionError(error: unknown): boolean {
    if (isAuthSessionMissingError(error)) return true;
    if (!isAuthApiError(error)) return false;
    return error.code !== undefined && DEAD_SESSION_CODES.has(error.code);
}
