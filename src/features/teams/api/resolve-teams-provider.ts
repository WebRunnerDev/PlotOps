import type { TeamsProvider } from "@/features/teams/api/teams-provider";

import { guestTeamsProvider } from "@/features/teams/api/guest-teams";
import { supabaseTeamsProvider } from "@/features/teams/api/supabase-teams";

/**
 * Pick the Teams provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveTeamsProvider(isGuest: boolean): TeamsProvider {
    return isGuest ? guestTeamsProvider : supabaseTeamsProvider;
}
