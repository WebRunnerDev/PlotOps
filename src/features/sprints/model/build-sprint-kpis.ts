import { isTaskEstimate } from "@/features/tasks";

export type SprintKpiEmptyReason = "no_closed_sprints";

export type SprintKpiMetric = "count" | "points";

export type SprintKpis = {
    /** Completed / committed over the window; null when committed total is 0. */
    commitmentAccuracy: null | number;
    emptyReason?: SprintKpiEmptyReason;
    metric: SprintKpiMetric;
    sampleSize: number;
    /** Average completed work across sampled Closed sprints. */
    velocity: null | number;
    windowSize: number;
};

export type SprintKpiSprint = {
    closedAt?: string;
    committedTaskIds: readonly string[];
    completedTaskIds: readonly string[];
    id: string;
};

export type SprintKpiTask = {
    estimate?: null | number;
    id: string;
};

const DEFAULT_LAST_N = 5;

/**
 * Board Insights KPIs from Closed Sprint Commitment + completion snapshots.
 * Prefers points when any Estimate exists in the window; otherwise task count.
 * No server aggregation — Free-tier friendly client compute.
 */
export function buildSprintKpis(input: {
    closedSprints: readonly SprintKpiSprint[];
    lastN?: number;
    tasks: readonly SprintKpiTask[];
}): SprintKpis {
    const windowSize = Math.max(1, input.lastN ?? DEFAULT_LAST_N);
    const sampled = [...input.closedSprints]
        .toSorted((left, right) => {
            const leftAt = left.closedAt ?? "";
            const rightAt = right.closedAt ?? "";
            return rightAt.localeCompare(leftAt);
        })
        .slice(0, windowSize);

    if (sampled.length === 0) {
        return {
            commitmentAccuracy: null,
            emptyReason: "no_closed_sprints",
            metric: "count",
            sampleSize: 0,
            velocity: null,
            windowSize,
        };
    }

    const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
    const knownIds = new Set<string>();
    for (const sprint of sampled) {
        for (const id of sprint.committedTaskIds) knownIds.add(id);
        for (const id of sprint.completedTaskIds) knownIds.add(id);
    }
    const metric = resolveMetric([...knownIds], tasksById);

    let completedSum = 0;
    let committedSum = 0;
    for (const sprint of sampled) {
        completedSum += measureIds(sprint.completedTaskIds, metric, tasksById);
        committedSum += measureIds(sprint.committedTaskIds, metric, tasksById);
    }

    const velocity = roundMetric(completedSum / sampled.length);
    const commitmentAccuracy =
        committedSum > 0 ? roundMetric(completedSum / committedSum) : null;

    return {
        commitmentAccuracy,
        metric,
        sampleSize: sampled.length,
        velocity,
        windowSize,
    };
}

function measureIds(
    ids: readonly string[],
    metric: SprintKpiMetric,
    tasksById: ReadonlyMap<string, SprintKpiTask>
): number {
    if (metric === "count") return ids.length;
    let sum = 0;
    for (const id of ids) {
        const estimate = tasksById.get(id)?.estimate;
        if (isTaskEstimate(estimate)) sum += estimate;
    }
    return sum;
}

function resolveMetric(
    knownIds: readonly string[],
    tasksById: ReadonlyMap<string, SprintKpiTask>
): SprintKpiMetric {
    for (const id of knownIds) {
        if (isTaskEstimate(tasksById.get(id)?.estimate)) return "points";
    }
    return "count";
}

function roundMetric(value: number): number {
    return Math.round(value * 100) / 100;
}
