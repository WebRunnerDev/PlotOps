import type { Task, TaskPriority } from "@/features/tasks/model/types";

import { TASK_PRIORITIES } from "@/features/tasks/model/constants";

export type BoardSortDirection = "asc" | "desc";

/** Per-viewer Board sort preference (field + direction, or Manual). */
export type BoardSortPreference =
    { direction: BoardSortDirection; field: "priority" } | { field: "manual" };

export const DEFAULT_BOARD_SORT: BoardSortPreference = { field: "manual" };

/** Higher rank = more urgent. Built from TASK_PRIORITIES (urgent → low). */
const PRIORITY_RANK = Object.fromEntries(
    TASK_PRIORITIES.toReversed().map((priority, index) => [priority, index])
) as Record<TaskPriority, number>;

/**
 * Reorder Tasks for Board sort display. Does not mutate input or Manual order.
 * Null Priority always sorts last. Ties: Title A→Z, then Manual order.
 */
export function sortTasksByBoardSort(
    tasks: Task[],
    sort: BoardSortPreference
): Task[] {
    if (sort.field === "manual") {
        return [...tasks];
    }

    const direction = sort.direction === "asc" ? 1 : -1;

    return tasks
        .map((task, manualIndex) => ({ manualIndex, task }))
        .toSorted((left, right) => {
            const leftRank = priorityRank(left.task.priority);
            const rightRank = priorityRank(right.task.priority);

            const leftMissing = leftRank === undefined;
            const rightMissing = rightRank === undefined;

            if (leftMissing && rightMissing) {
                return compareTies(left, right);
            }
            if (leftMissing) return 1;
            if (rightMissing) return -1;

            if (leftRank !== rightRank) {
                return (leftRank - rightRank) * direction;
            }

            return compareTies(left, right);
        })
        .map(({ task }) => task);
}

function compareTies(
    left: { manualIndex: number; task: Task },
    right: { manualIndex: number; task: Task }
): number {
    const byTitle = left.task.title.localeCompare(right.task.title);
    if (byTitle !== 0) return byTitle;
    return left.manualIndex - right.manualIndex;
}

function priorityRank(priority: Task["priority"]): number | undefined {
    if (!priority) return undefined;
    return PRIORITY_RANK[priority];
}
