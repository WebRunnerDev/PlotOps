import type { Task, TaskPriority } from "@/features/tasks/model/types";

import { TASK_PRIORITIES } from "@/features/tasks/model/constants";

export type BoardSortDirection = "asc" | "desc";

export type BoardSortField = "created" | "deadline" | "priority" | "title";

/** Per-viewer Board sort preference (field + direction, or Manual). */
export type BoardSortPreference =
    | { direction: BoardSortDirection; field: BoardSortField }
    | { field: "manual" };

export const DEFAULT_BOARD_SORT: BoardSortPreference = { field: "manual" };

/** Higher rank = more urgent. Built from TASK_PRIORITIES (urgent → low). */
const PRIORITY_RANK = Object.fromEntries(
    TASK_PRIORITIES.toReversed().map((priority, index) => [priority, index])
) as Record<TaskPriority, number>;

type IndexedTask = { manualIndex: number; task: Task };

/**
 * Reorder Tasks for Board sort display. Does not mutate input or Manual order.
 * Null Priority / Deadline always sort last. Ties: Title A→Z, then Manual order
 * (Title Board sort ties → Manual order only).
 */
export function sortTasksByBoardSort(
    tasks: Task[],
    sort: BoardSortPreference
): Task[] {
    if (sort.field === "manual") {
        return [...tasks];
    }

    const direction = sort.direction === "asc" ? 1 : -1;
    const { field } = sort;

    return tasks
        .map((task, manualIndex) => ({ manualIndex, task }))
        .toSorted((left, right) => {
            const byField = compareField(
                left.task,
                right.task,
                field,
                direction
            );
            if (byField !== 0) return byField;
            return compareTies(left, right, field);
        })
        .map(({ task }) => task);
}

function compareField(
    left: Task,
    right: Task,
    field: BoardSortField,
    direction: number
): number {
    switch (field) {
        case "created": {
            return left.createdAt.localeCompare(right.createdAt) * direction;
        }
        case "deadline": {
            return compareNullableOrdered(
                left.deadline,
                right.deadline,
                direction,
                (a, b) => a.localeCompare(b)
            );
        }
        case "priority": {
            return compareNullableOrdered(
                priorityRank(left.priority),
                priorityRank(right.priority),
                direction,
                (a, b) => a - b
            );
        }
        case "title": {
            return left.title.localeCompare(right.title) * direction;
        }
    }
}

function compareNullableOrdered<T>(
    left: T | undefined,
    right: T | undefined,
    direction: number,
    compare: (a: T, b: T) => number
): number {
    const leftMissing = left === undefined || left === "";
    const rightMissing = right === undefined || right === "";

    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;

    const ordered = compare(left, right);
    return ordered === 0 ? 0 : ordered * direction;
}

function compareTies(
    left: IndexedTask,
    right: IndexedTask,
    field: BoardSortField
): number {
    if (field !== "title") {
        const byTitle = left.task.title.localeCompare(right.task.title);
        if (byTitle !== 0) return byTitle;
    }
    return left.manualIndex - right.manualIndex;
}

function priorityRank(priority: Task["priority"]): number | undefined {
    if (!priority) return undefined;
    return PRIORITY_RANK[priority];
}
