/**
 * True when sprint scope or board filters hide at least one task from the board.
 */
export function isBoardTaskViewRestricted(
    allTasks: ReadonlyArray<{ id: string }>,
    displayedTasks: ReadonlyArray<{ id: string }>
): boolean {
    return displayedTasks.length < allTasks.length;
}
