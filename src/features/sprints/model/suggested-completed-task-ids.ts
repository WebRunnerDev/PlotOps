/**
 * Close Sprint: which member Tasks to pre-check as completed.
 * Prefers columns marked Done (`isDone`); falls back to the rightmost column
 * when none are marked (pre-migration / empty boards).
 */
export function suggestedCompletedTaskIds(input: {
    columns: ReadonlyArray<{ id: string; isDone: boolean }>;
    tasks: ReadonlyArray<{ id: string; status: string }>;
}): Set<string> {
    const doneColumnIds = new Set(
        input.columns
            .filter((column) => column.isDone)
            .map((column) => column.id)
    );

    const fallbackId = input.columns.at(-1)?.id;
    const statusIds =
        doneColumnIds.size > 0
            ? doneColumnIds
            : new Set(fallbackId ? [fallbackId] : []);

    if (statusIds.size === 0) return new Set();

    return new Set(
        input.tasks
            .filter((task) => statusIds.has(task.status))
            .map((task) => task.id)
    );
}
