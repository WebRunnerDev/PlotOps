import type { BoardColumn } from "@/features/boards";
import type { TaskMoveUpdate } from "@/features/tasks/lib/reorder-tasks-in-memory";
import type { Task, TaskStatus } from "@/features/tasks/model/types";

import { applyVisibleColumnOrder } from "@/features/tasks/lib/apply-visible-column-order";
import { resolveBoardDropTargetId } from "@/features/tasks/lib/board-drop-target-id";

/**
 * Move one or more tasks into a column (by column id or a task living there).
 * Tasks already in the target column are left alone. Moving tasks keep board
 * list order and insert as a block at the drop index.
 *
 * When `displayedTaskIds` is set, insert among the visible target-column cards
 * and keep hidden siblings in their original slots.
 */
export function moveTasksToColumnInMemory(
    tasks: Task[],
    columns: BoardColumn[],
    activeIds: readonly string[],
    overId: string,
    displayedTaskIds?: ReadonlySet<string>
): undefined | { tasks: Task[]; updates: TaskMoveUpdate[] } {
    if (activeIds.length === 0) return undefined;

    const resolvedOverId = resolveBoardDropTargetId(overId);
    const overTask = tasks.find((task) => task.id === resolvedOverId);
    const overIsColumn = columns.some((column) => column.id === resolvedOverId);
    if (!overTask && !overIsColumn) return undefined;

    const targetStatus = overTask ? overTask.status : resolvedOverId;
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

    const useVisibleInsert =
        displayedTaskIds !== undefined &&
        withoutMoving.some(
            (task) =>
                task.status === targetStatus && !displayedTaskIds.has(task.id)
        );

    let next: Task[];
    if (useVisibleInsert) {
        const targetIndices: number[] = [];
        for (const [index, task] of withoutMoving.entries()) {
            if (task.status === targetStatus) targetIndices.push(index);
        }

        const existingColumn = targetIndices.map(
            (index) => withoutMoving[index]!
        );
        const visibleExisting = existingColumn
            .filter((task) => displayedTaskIds.has(task.id))
            .map((task) => task.id);

        let insertAt = visibleExisting.length;
        if (overTask && !movingIdSet.has(overTask.id)) {
            const overVisibleIndex = displayedTaskIds.has(resolvedOverId)
                ? visibleExisting.indexOf(resolvedOverId)
                : -1;
            if (overVisibleIndex !== -1) insertAt = overVisibleIndex;
        }

        const visibleAfterInsert = [
            ...visibleExisting.slice(0, insertAt),
            ...movingTasks.map((task) => task.id),
            ...visibleExisting.slice(insertAt),
        ];
        const nextColumn = applyVisibleColumnOrder(
            [...existingColumn, ...movingTasks],
            visibleAfterInsert
        );

        next = [...withoutMoving];
        let columnPointer = 0;
        for (const index of targetIndices) {
            if (columnPointer >= nextColumn.length) break;
            next[index] = nextColumn[columnPointer]!;
            columnPointer += 1;
        }
        if (columnPointer < nextColumn.length) {
            const tailIndex = targetIndices.at(-1);
            const insertIndex =
                tailIndex === undefined ? next.length : tailIndex + 1;
            next.splice(insertIndex, 0, ...nextColumn.slice(columnPointer));
        }
    } else {
        let insertIndex: number;
        if (overTask && !movingIdSet.has(overTask.id)) {
            insertIndex = withoutMoving.findIndex(
                (task) => task.id === resolvedOverId
            );
            if (insertIndex === -1) insertIndex = withoutMoving.length;
        } else {
            let lastIndex = -1;
            for (const [index, task] of withoutMoving.entries()) {
                if (task.status === targetStatus) lastIndex = index;
            }
            insertIndex = lastIndex + 1;
        }

        next = [...withoutMoving];
        next.splice(insertIndex, 0, ...movingTasks);
    }

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
