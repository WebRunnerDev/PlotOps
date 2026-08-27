export type CreateTasksRealtimeInvalidationControllerOptions = {
    debounceMs?: number;
    invalidate: () => void;
    /**
     * How many local board-task move mutations are currently `pending`
     * (TanStack `isMutating`). Includes the mutation whose `onSettled` is
     * running.
     */
    pendingMoveCount: () => number;
    schedule?: (callback: () => void, ms: number) => () => void;
};

/**
 * Coalesce Realtime + mutation-settled board-task invalidations so a single
 * drag-drop does not refetch twice during the drop animation (optimistic UI
 * already shows the final placement; a second layout pass re-triggers sortable
 * CSS transitions and looks like a duplicated move).
 *
 * Note: TanStack Query still counts the settling mutation as `pending` inside
 * `onSettled` (status flips to success/error only after that callback). Use
 * `pendingMoveCount > 1` there, not `> 0`.
 */
export type TasksRealtimeInvalidationController = {
    dispose: () => void;
    /** Call when a local move mutation settles (success or error). */
    onMoveSettled: () => void;
    /** Call from Supabase `postgres_changes` (and similar). */
    requestInvalidation: () => void;
};

const DEFAULT_DEBOUNCE_MS = 80;

export function createTasksRealtimeInvalidationController(
    options: CreateTasksRealtimeInvalidationControllerOptions
): TasksRealtimeInvalidationController {
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const schedule =
        options.schedule ??
        ((callback, ms) => {
            const id = globalThis.setTimeout(callback, ms);
            return () => globalThis.clearTimeout(id);
        });

    let cancelScheduled: (() => void) | undefined;

    const clearScheduled = () => {
        cancelScheduled?.();
        cancelScheduled = undefined;
    };

    const runInvalidate = () => {
        clearScheduled();
        options.invalidate();
    };

    const scheduleInvalidate = () => {
        clearScheduled();
        cancelScheduled = schedule(runInvalidate, debounceMs);
    };

    return {
        dispose: () => {
            clearScheduled();
        },
        onMoveSettled: () => {
            // Still counted as pending during onSettled; >1 means others remain.
            if (options.pendingMoveCount() > 1) {
                return;
            }
            scheduleInvalidate();
        },
        requestInvalidation: () => {
            if (options.pendingMoveCount() > 0) {
                return;
            }
            scheduleInvalidate();
        },
    };
}
