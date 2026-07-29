/**
 * Target column for active tasks when deleting a board column.
 *
 * Only needed when the column still has visible (non-archived) tasks.
 * Archived tasks keep their status until restore remaps a missing column.
 */
export function resolveColumnDeleteMoveTarget(input: {
    otherColumnId: string | undefined;
    visibleTaskCount: number;
}): string | undefined {
    if (input.visibleTaskCount <= 0) return undefined;
    return input.otherColumnId;
}
