import type { TasksProvider } from "@/features/tasks/api/tasks-provider";

import { guestTasksProvider } from "@/features/tasks/api/guest-tasks";
import { supabaseTasksProvider } from "@/features/tasks/api/supabase-tasks";

/**
 * Pick the Tasks provider for the current session.
 * Guest demos use the local sandbox — no Supabase Auth/Postgres/Realtime.
 */
export function resolveTasksProvider(isGuest: boolean): TasksProvider {
    return isGuest ? guestTasksProvider : supabaseTasksProvider;
}
