import type { BoardColumn } from "@/features/boards";
import type { TaskMoveUpdate } from "@/features/tasks/lib/reorder-tasks-in-memory";
import type { Task, TaskStatus } from "@/features/tasks/model/types";

/**
 * Move one or more tasks into a column (by column id or a task living there).
 * Tasks already in the target column are left alone. Moving tasks keep board
 * list order and insert as a block at the drop index.
 */
export function moveTasksToColumnInMemory(
    tasks: Task[],
    columns: BoardColumn[],
    activeIds: readonly string[],
    overId: string
): undefined | { tasks: Task[]; updates: TaskMoveUpdate[] } {
    if (activeIds.length === 0) return undefined;

    const overTask = tasks.find((task) => task.id === overId);
    const overIsColumn = columns.some((column) => column.id === overId);
    if (!overTask && !overIsColumn) return undefined;

    const targetStatus = overTask ? overTask.status : overId;
    const movingIdSet = new Set(
        activeIds.filter((id) => {
            const task = tasks.find((entry) => entry.id === id);
            return Boolean(task && task.status !== targetStatus);
        })
    );
    if (movingIdSet.size === 0) return undefined;

    const movingTasks = tasks
        .filter((task) => movingIdSet.has(task.id))
        .map((task) => ({ ...task, status: targetStatus }));
    const withoutMoving = tasks.filter((task) => !movingIdSet.has(task.id));

    let insertIndex: number;
    if (overTask && !movingIdSet.has(overTask.id)) {
        insertIndex = withoutMoving.findIndex((task) => task.id === overId);
        if (insertIndex === -1) insertIndex = withoutMoving.length;
    } else {
        let lastIndex = -1;
        for (const [index, task] of withoutMoving.entries()) {
            if (task.status === targetStatus) lastIndex = index;
        }
        insertIndex = lastIndex + 1;
    }

    const next = [...withoutMoving];
    next.splice(insertIndex, 0, ...movingTasks);

    const affectedStatuses = new Set<TaskStatus>([targetStatus]);
    for (const task of tasks) {
        if (movingIdSet.has(task.id)) {
            affectedStatuses.add(task.status);
        }
    }

    const updates: TaskMoveUpdate[] = [];
    for (const status of affectedStatuses) {
        const columnTasks = next.filter((task) => task.status === status);
        for (const [position, task] of columnTasks.entries()) {
            updates.push({
                id: task.id,
                position,
                status,
            });
        }
    }

    return { tasks: next, updates };
}
