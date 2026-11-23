import type { User } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";

/**
 * Signed-in user from the stored session — no Auth API round trip.
 *
 * For API calls that only need the user's id or display name before a
 * PostgREST/Storage request. That request carries the JWT and RLS checks it on
 * the server, so a second `/auth/v1/user` call adds latency without adding
 * security. Use `getUser()` only where a fresh server copy of the user matters.
 */
export async function getSessionUser(): Promise<null | User> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
}
