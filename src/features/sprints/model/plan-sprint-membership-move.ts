import type { Task } from "@/features/tasks";

export type SprintMembershipUpdate = {
    sprintId: null | string;
    sprintPosition: null | number;
    taskId: string;
};

/** Apply planned membership updates to an in-memory task list (optimistic cache). */
export function applySprintMembershipUpdates(
    tasks: readonly Task[],
    updates: readonly SprintMembershipUpdate[]
): Task[] {
    const byId = new Map(updates.map((update) => [update.taskId, update]));

    return tasks.map((task) => {
        const update = byId.get(task.id);
        if (!update) return task;

        const next: Task = { ...task };
        if (update.sprintId === null) {
            delete next.sprintId;
        } else {
            next.sprintId = update.sprintId;
        }

        if (update.sprintPosition === null) {
            delete next.sprintPosition;
        } else {
            next.sprintPosition = update.sprintPosition;
        }

        return next;
    });
}

/**
 * Plan append-at-end sprint membership updates from a tasks snapshot.
 * Callers must apply pending updates to the snapshot (or read a fresh cache)
 * before the next move so concurrent drags do not reuse the same max position.
 */
export function planSprintMembershipMove(input: {
    targetSprintId: null | string;
    taskIds: readonly string[];
    tasks: readonly Task[];
}): SprintMembershipUpdate[] {
    const uniqueIds = [...new Set(input.taskIds)];
    if (uniqueIds.length === 0) return [];

    const targetSiblings = input.targetSprintId
        ? input.tasks.filter((task) => task.sprintId === input.targetSprintId)
        : input.tasks.filter((task) => !task.sprintId);

    const movingIds = uniqueIds.filter((id) => {
        const task = input.tasks.find((item) => item.id === id);
        if (!task) return false;
        return (task.sprintId ?? null) !== input.targetSprintId;
    });

    if (movingIds.length === 0) return [];

    let maxPosition = -1;
    for (const task of targetSiblings) {
        if (!movingIds.includes(task.id)) {
            maxPosition = Math.max(maxPosition, task.sprintPosition ?? -1);
        }
    }

    return movingIds.map((taskId, index) => ({
        sprintId: input.targetSprintId,
        sprintPosition: maxPosition + 1 + index,
        taskId,
    }));
}
