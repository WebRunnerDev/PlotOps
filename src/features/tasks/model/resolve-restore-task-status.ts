/**
 * Status to use when restoring an archived task.
 * Remaps if the original column was deleted while the task was archived.
 */
export function resolveRestoreTaskStatus(
    status: string,
    columnIds: readonly string[]
): string {
    if (columnIds.includes(status)) return status;

    const fallback = columnIds[0];
    if (!fallback) {
        throw new Error("Cannot restore task: board has no columns");
    }
    return fallback;
}
