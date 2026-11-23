export type CreateTasksRealtimeInvalidationControllerOptions = {
    debounceMs?: number;
    /**
     * Refetch the Tasks slice. Return the refetch promise so the controller can
     * hold later requests until it settles instead of cancelling it.
     */
    invalidate: () => Promise<unknown> | void;
    /** Upper bound on how long a steady stream of requests can defer a refetch. */
    maxWaitMs?: number;
    now?: () => number;
    /**
     * How many local board-task move mutations are currently `pending`
     * (TanStack `isMutating`). Includes the mutation whose `onSettled` is
     * running.
     */
    pendingMoveCount: () => number;
    schedule?: (callback: () => void, ms: number) => () => void;
};

/**
 * One refetch path for the Tasks slice of a Project: Realtime events and local
 * mutations both request a refresh here.
 *
 * - Coalesces: a local write and its Realtime echo (and bursts such as a
 *   multi-select move or an MCP agent editing many Tasks) become one refetch.
 *   `maxWaitMs` keeps a continuous stream from starving the board.
 * - Never cancels: TanStack `invalidateQueries` cancels an in-flight refetch
 *   and starts over, so back-to-back requests used to restart the full board
 *   query repeatedly. A request that lands mid-flight runs once after it.
 * - Move gating: a drag-drop does not refetch twice during the drop animation
 *   (optimistic UI already shows the final placement; a second layout pass
 *   re-triggers sortable CSS transitions and looks like a duplicated move).
 *
 * Note: TanStack Query still counts the settling mutation as `pending` inside
 * `onSettled` (status flips to success/error only after that callback). Use
 * `pendingMoveCount > 1` there, not `> 0`.
 */
export type TasksRealtimeInvalidationController = {
    /** Stop the controller; a refresh still waiting on its timer runs now. */
    dispose: () => void;
    /** Call when a local move mutation settles (success or error). */
    onMoveSettled: () => void;
    /** Call from Supabase `postgres_changes` and from local mutations. */
    requestInvalidation: () => void;
};

const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MAX_WAIT_MS = 1000;

export function createTasksRealtimeInvalidationController(
    options: CreateTasksRealtimeInvalidationControllerOptions
): TasksRealtimeInvalidationController {
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const maxWaitMs = Math.max(
        debounceMs,
        options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS
    );
    const now = options.now ?? (() => Date.now());
    const schedule =
        options.schedule ??
        ((callback, ms) => {
            const id = globalThis.setTimeout(callback, ms);
            return () => globalThis.clearTimeout(id);
        });

    let cancelScheduled: (() => void) | undefined;
    /** When the oldest request still waiting on the timer arrived. */
    let firstRequestAt: number | undefined;
    let inFlight = false;
    let rerunAfterFlight = false;
    let disposed = false;

    const clearScheduled = () => {
        cancelScheduled?.();
        cancelScheduled = undefined;
    };

    const runInvalidate = () => {
        clearScheduled();
        firstRequestAt = undefined;

        if (inFlight) {
            rerunAfterFlight = true;
            return;
        }

        const result = options.invalidate();
        if (!result) return;

        inFlight = true;
        void Promise.resolve(result)
            .catch(() => {})
            .finally(() => {
                inFlight = false;
                if (!rerunAfterFlight) return;
                rerunAfterFlight = false;
                if (disposed) {
                    void options.invalidate();
                    return;
                }
                scheduleInvalidate();
            });
    };

    const scheduleInvalidate = () => {
        const requestedAt = now();
        firstRequestAt ??= requestedAt;
        const remaining = maxWaitMs - (requestedAt - firstRequestAt);
        clearScheduled();
        cancelScheduled = schedule(
            runInvalidate,
            Math.max(0, Math.min(debounceMs, remaining))
        );
    };

    return {
        dispose: () => {
            if (disposed) return;
            disposed = true;
            // Leaving the Board must not drop a refresh a mutation asked for.
            const hadPending = cancelScheduled !== undefined;
            clearScheduled();
            firstRequestAt = undefined;
            if (!hadPending) return;
            if (inFlight) {
                rerunAfterFlight = true;
                return;
            }
            void options.invalidate();
        },
        onMoveSettled: () => {
            // Still counted as pending during onSettled; >1 means others remain.
            if (options.pendingMoveCount() > 1) {
                return;
            }
            scheduleInvalidate();
        },
        requestInvalidation: () => {
            if (disposed) {
                void options.invalidate();
                return;
            }
            if (options.pendingMoveCount() > 0) {
                return;
            }
            scheduleInvalidate();
        },
    };
}
