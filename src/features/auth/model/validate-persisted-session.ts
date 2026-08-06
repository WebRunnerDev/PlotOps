import type { Session } from "@supabase/supabase-js";

import { clearGitHubAccessToken } from "@/features/auth/model/github-token";
import { supabase } from "@/shared/api/supabase";

export type ValidatePersistedSessionOptions = {
    signal?: AbortSignal;
};

/**
 * `getSession()` reads local storage and can return a JWT after `db reset`
 * (or any server-side auth wipe). Confirm with the Auth API before treating
 * the user as signed in.
 *
 * Callers must pass `signal` from the boot effect cleanup. A stale Strict Mode
 * (or remount) validation must not `signOut` after a newer boot has already
 * applied a valid session — that leaves React thinking the user is signed in
 * while PostgREST has no JWT, so RLS returns "project not found / no access".
 */
export async function validatePersistedSession(
    session: null | Session,
    options: ValidatePersistedSessionOptions = {}
): Promise<null | Session> {
    if (!session) return null;
    if (options.signal?.aborted) return null;

    const { data, error } = await supabase.auth.getUser();

    // Stale boots must not clear storage — the remount may already own the session.
    if (options.signal?.aborted) return null;

    if (error || !data.user) {
        await supabase.auth.signOut({ scope: "local" });
        clearGitHubAccessToken();
        return null;
    }

    return { ...session, user: data.user };
}
