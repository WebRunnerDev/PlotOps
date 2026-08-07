import type { TaskEstimate } from "@/features/tasks/lib/task-estimate";

import { isTaskEstimate } from "@/features/tasks/lib/task-estimate";

export type TaskEstimateSummary = {
    estimatedCount: number;
    pointsSum: number;
    taskCount: number;
    unestimatedCount: number;
};

/**
 * Sprint report / Active badge: points are primary when present;
 * task count stays available as secondary.
 */
export function summarizeTaskEstimates(
    tasks: ReadonlyArray<{ estimate?: null | number | TaskEstimate }>
): TaskEstimateSummary {
    let pointsSum = 0;
    let estimatedCount = 0;
    let unestimatedCount = 0;

    for (const task of tasks) {
        if (isTaskEstimate(task.estimate)) {
            pointsSum += task.estimate;
            estimatedCount += 1;
        } else {
            unestimatedCount += 1;
        }
    }

    return {
        estimatedCount,
        pointsSum,
        taskCount: tasks.length,
        unestimatedCount,
    };
}
