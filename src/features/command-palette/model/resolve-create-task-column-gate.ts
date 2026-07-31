export type CreateTaskColumnGate = "empty" | "loading" | "ready";

/**
 * Create Task must not treat an unloaded columns query as a real empty board.
 */
export function resolveCreateTaskColumnGate(
    columnsReady: boolean,
    firstColumnId?: string
): CreateTaskColumnGate {
    if (!columnsReady) return "loading";
    if (!firstColumnId) return "empty";
    return "ready";
}
