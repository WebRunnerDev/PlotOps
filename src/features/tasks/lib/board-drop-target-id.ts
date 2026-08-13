const COLUMN_TASK_DROP_PREFIX = "column-tasks:";

export function columnTaskDropId(status: string) {
    return `${COLUMN_TASK_DROP_PREFIX}${status}`;
}

/** Maps column task-list droppables back to board column ids. */
export function resolveBoardDropTargetId(overId: string) {
    return overId.startsWith(COLUMN_TASK_DROP_PREFIX)
        ? overId.slice(COLUMN_TASK_DROP_PREFIX.length)
        : overId;
}
