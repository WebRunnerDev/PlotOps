import type { SprintsProvider } from "@/features/sprints/api/sprints-provider";

import { guestSprintsProvider } from "@/features/sprints/api/guest-sprints-provider";
import { supabaseSprintsProvider } from "@/features/sprints/api/supabase-sprints-provider";

/**
 * Pick the Sprint provider for the current session.
 * Guest demos stay in the local sandbox — never Supabase.
 */
export function resolveSprintsProvider(isGuest: boolean): SprintsProvider {
    return isGuest ? guestSprintsProvider : supabaseSprintsProvider;
}
