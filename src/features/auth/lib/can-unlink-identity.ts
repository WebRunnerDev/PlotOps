import type { UserIdentity } from "@supabase/supabase-js";

/** ADR 0026: never remove the last remaining sign-in method. */
export function canUnlinkIdentity(identities: UserIdentity[]): boolean {
    return identities.length > 1;
}
