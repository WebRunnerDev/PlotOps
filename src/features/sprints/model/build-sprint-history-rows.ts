import type { Sprint } from "@/features/sprints/model/types";

import { isTaskEstimate } from "@/features/tasks";

export type SprintHistoryMetric = "count" | "points";

export type SprintHistoryRow = {
    committed: number;
    completed: null | number;
    /** completed ÷ committed; null for Canceled or an empty commitment. */
    completion: null | number;
    endedAt?: string;
    sprint: Sprint;
};

/**
 * Closed and Canceled sprints for the Sprints page history table, newest
 * first. One metric for the whole table: points when any committed Task in
 * the history carries an Estimate, else task count (matches Velocity).
 */
export function buildSprintHistoryRows(input: {
    sprints: readonly Sprint[];
    tasks: ReadonlyArray<{ estimate?: null | number; id: string }>;
}): { metric: SprintHistoryMetric; rows: SprintHistoryRow[] } {
    const past = input.sprints
        .filter(
            (sprint) => sprint.state === "closed" || sprint.state === "canceled"
        )
        .map((sprint) => ({
            endedAt: sprint.closedAt ?? sprint.canceledAt,
            sprint,
        }))
        .toSorted((left, right) =>
            (right.endedAt ?? right.sprint.createdAt).localeCompare(
                left.endedAt ?? left.sprint.createdAt
            )
        );

    const estimateById = new Map(
        input.tasks.map((task) => [task.id, task.estimate])
    );
    const metric: SprintHistoryMetric = past.some(({ sprint }) =>
        sprint.committedTaskIds.some((id) =>
            isTaskEstimate(estimateById.get(id))
        )
    )
        ? "points"
        : "count";

    const measure = (ids: readonly string[]) => {
        if (metric === "count") return ids.length;
        let sum = 0;
        for (const id of ids) {
            const estimate = estimateById.get(id);
            if (isTaskEstimate(estimate)) sum += estimate;
        }
        return sum;
    };

    return {
        metric,
        rows: past.map(({ endedAt, sprint }) => {
            const committed = measure(sprint.committedTaskIds);
            if (sprint.state === "canceled") {
                return {
                    committed,
                    completed: null,
                    completion: null,
                    endedAt,
                    sprint,
                };
            }
            const completed = measure(sprint.completedTaskIds);
            return {
                committed,
                completed,
                completion: committed > 0 ? completed / committed : null,
                endedAt,
                sprint,
            };
        }),
    };
}
