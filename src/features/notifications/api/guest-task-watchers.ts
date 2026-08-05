import type { TaskWatcher } from "@/features/notifications/model/types";

type GuestWatchersState = {
    isWatching: boolean;
    watchers: TaskWatcher[];
};

/**
 * Guest has no remote `task_watchers` / profiles join — empty show,
 * mute toggles (no Supabase). Spec: no local notification fan-out engine.
 */
export function fetchGuestTaskWatchers(input: {
    taskId: string;
}): GuestWatchersState {
    void input;
    return { isWatching: false, watchers: [] };
}

export function setGuestTaskWatch(input: {
    taskId: string;
    watching: boolean;
}): void {
    void input;
    // No-op: Guest Mode does not persist watches.
}
