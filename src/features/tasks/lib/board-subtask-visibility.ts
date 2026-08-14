import { subtasksOf } from "./task-structure";

export type BoardSubtaskNode = {
    id: string;
    isDone: boolean;
    parentId?: string;
};

export type SubtaskProgress = {
    done: number;
    total: number;
};

export function parentSubtaskProgress(
    parentId: string,
    tasks: readonly BoardSubtaskNode[]
): SubtaskProgress | undefined {
    const children = subtasksOf(parentId, tasks);
    if (children.length === 0) {
        return undefined;
    }

    return {
        done: children.filter((child) => child.isDone).length,
        total: children.length,
    };
}

export function visibleBoardTasks<T extends { parentId?: string }>(
    tasks: readonly T[],
    hideSubtasks: boolean
): T[] {
    if (!hideSubtasks) {
        return [...tasks];
    }

    return tasks.filter((task) => task.parentId === undefined);
}
