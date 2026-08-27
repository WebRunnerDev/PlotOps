export type BoardDoneColumn = {
    id: string;
    isDone: boolean;
};

export function doneColumnIdSet(
    columns: ReadonlyArray<BoardDoneColumn>
): Set<string> {
    return new Set(
        columns.filter((column) => column.isDone).map((column) => column.id)
    );
}

export function hideCompletedBoardTasks<T extends { status: string }>(
    tasks: readonly T[],
    doneColumnIds: ReadonlySet<string>,
    hideCompleted: boolean
): T[] {
    if (!hideCompleted || doneColumnIds.size === 0) {
        return [...tasks];
    }

    return tasks.filter((task) => !doneColumnIds.has(task.status));
}
