export type CreateTaskColumnGate = "empty" | "error" | "loading" | "ready";

/**
 * Create Task must not treat an unloaded columns query as a real empty board,
 * and must not stay stuck in loading when the columns fetch failed.
 */
export function resolveCreateTaskColumnGate(
    columnsReady: boolean,
    firstColumnId?: string,
    columnsError = false
): CreateTaskColumnGate {
    if (!columnsReady) {
        return columnsError ? "error" : "loading";
    }
    if (!firstColumnId) return "empty";
    return "ready";
}
