import type { AuthError, User } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";

export type VerifiedAuthUserResult = {
    error: AuthError | null;
    user: null | User;
};

/** Access token the Auth API last accepted. */
let verifiedAccessToken: null | string = null;

/**
 * Confirms the stored session with the Auth API at most once per access token.
 *
 * `getUser()` is a network round trip; calling it from every route
 * `beforeLoad` and every tab-focus `SIGNED_IN` made each navigation wait on
 * Auth. The access token rotates about hourly, so a token the server already
 * accepted only needs re-checking after it changes.
 *
 * `getSession()` reads storage and refreshes an expiring token, so the token
 * sent to `/user` is current. On a cache hit the user comes from that session,
 * not from the earlier check: `USER_UPDATED` changes metadata without rotating
 * the token, and storage already holds the new values.
 */
export async function getVerifiedAuthUser(): Promise<VerifiedAuthUserResult> {
    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) return { error: sessionError, user: null };
    if (!session) {
        verifiedAccessToken = null;
        return { error: null, user: null };
    }

    if (verifiedAccessToken === session.access_token) {
        return { error: null, user: session.user };
    }

    const { data, error } = await supabase.auth.getUser(session.access_token);
    if (error || !data.user) {
        verifiedAccessToken = null;
        return { error, user: null };
    }

    verifiedAccessToken = session.access_token;
    return { error: null, user: data.user };
}

/** Forget the cached verification (sign-out, tests). */
export function resetVerifiedAuthUser() {
    verifiedAccessToken = null;
}
