import type { ProjectsProvider } from "@/features/projects/api/projects-provider";

import { guestProjectsProvider } from "@/features/projects/api/guest-projects";
import { supabaseProjectsProvider } from "@/features/projects/api/supabase-projects";

/**
 * Pick the Projects provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveProjectsProvider(isGuest: boolean): ProjectsProvider {
    return isGuest ? guestProjectsProvider : supabaseProjectsProvider;
}
