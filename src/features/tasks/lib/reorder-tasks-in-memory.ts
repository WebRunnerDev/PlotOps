import { arrayMove } from "@dnd-kit/sortable";

import type { Task, TaskStatus } from "@/features/tasks/model/types";

export type TaskMoveUpdate = {
    id: string;
    position: number;
    status: TaskStatus;
};

/**
 * Reorder within a single column using the full board task list.
 *
 * Must be column-local: a flat board-wide splice interlaces other columns and
 * can assign the wrong slot (often position 0) when dropping onto a card.
 * Hidden/filtered siblings stay in place because we move by id among the
 * full column, not the visible subset.
 */
export function reorderTasksInMemory(
    tasks: Task[],
    activeId: string,
    overId: string
): undefined | { tasks: Task[]; updates: TaskMoveUpdate[] } {
    const activeTask = tasks.find((task) => task.id === activeId);
    const overTask = tasks.find((task) => task.id === overId);
    if (!activeTask || !overTask) return undefined;
    if (activeTask.status !== overTask.status) return undefined;

    const status = activeTask.status;
    const columnTasks = tasks.filter((task) => task.status === status);
    const from = columnTasks.findIndex((task) => task.id === activeId);
    const to = columnTasks.findIndex((task) => task.id === overId);
    if (from === -1 || to === -1 || from === to) return undefined;

    const nextColumn = arrayMove(columnTasks, from, to);
    const updates = nextColumn.map((task, position) => ({
        id: task.id,
        position,
        status,
    }));

    let columnIndex = 0;
    const next = tasks.map((task) => {
        if (task.status !== status) return task;
        return nextColumn[columnIndex++]!;
    });

    return { tasks: next, updates };
}
