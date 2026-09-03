import { isTaskEstimate } from "@/features/tasks";

export type SprintKpiEmptyReason = "no_closed_sprints";

export type SprintKpiMetric = "count" | "points";

export type SprintKpis = {
    /** Completed / committed over the window; null when committed total is 0. */
    commitmentAccuracy: null | number;
    /** Window completed measure (for accuracy ring). */
    committedSum: number;
    completedSum: number;
    emptyReason?: SprintKpiEmptyReason;
    metric: SprintKpiMetric;
    sampleSize: number;
    /** Average completed work across sampled Closed sprints. */
    velocity: null | number;
    /** Per-sprint committed vs completed, oldest → newest. */
    velocitySeries: SprintVelocityPoint[];
    windowSize: number;
};

export type SprintKpiSprint = {
    closedAt?: string;
    committedTaskIds: readonly string[];
    completedTaskIds: readonly string[];
    id: string;
    name?: string;
};

export type SprintKpiTask = {
    estimate?: null | number;
    id: string;
};

export type SprintVelocityPoint = {
    committed: number;
    completed: number;
    label: string;
    sprintId: string;
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
    const sampledNewestFirst = [...input.closedSprints]
        .toSorted((left, right) => {
            const leftAt = left.closedAt ?? "";
            const rightAt = right.closedAt ?? "";
            return rightAt.localeCompare(leftAt);
        })
        .slice(0, windowSize);

    if (sampledNewestFirst.length === 0) {
        return {
            commitmentAccuracy: null,
            committedSum: 0,
            completedSum: 0,
            emptyReason: "no_closed_sprints",
            metric: "count",
            sampleSize: 0,
            velocity: null,
            velocitySeries: [],
            windowSize,
        };
    }

    const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
    const knownIds = new Set<string>();
    for (const sprint of sampledNewestFirst) {
        for (const id of sprint.committedTaskIds) knownIds.add(id);
        for (const id of sprint.completedTaskIds) knownIds.add(id);
    }
    const metric = resolveMetric([...knownIds], tasksById);

    let completedSum = 0;
    let committedSum = 0;
    const velocitySeriesNewestFirst: SprintVelocityPoint[] = [];
    for (const sprint of sampledNewestFirst) {
        const completed = measureIds(
            sprint.completedTaskIds,
            metric,
            tasksById
        );
        const committed = measureIds(
            sprint.committedTaskIds,
            metric,
            tasksById
        );
        completedSum += completed;
        committedSum += committed;
        velocitySeriesNewestFirst.push({
            committed: roundMetric(committed),
            completed: roundMetric(completed),
            label: sprintLabel(sprint),
            sprintId: sprint.id,
        });
    }

    const velocity = roundMetric(completedSum / sampledNewestFirst.length);
    const commitmentAccuracy =
        committedSum > 0 ? roundMetric(completedSum / committedSum) : null;

    return {
        commitmentAccuracy,
        committedSum: roundMetric(committedSum),
        completedSum: roundMetric(completedSum),
        metric,
        sampleSize: sampledNewestFirst.length,
        velocity,
        velocitySeries: velocitySeriesNewestFirst.toReversed(),
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

function sprintLabel(sprint: SprintKpiSprint): string {
    const name = sprint.name?.trim();
    if (name) return name;
    if (sprint.closedAt) {
        return sprint.closedAt.slice(0, 10);
    }
    return sprint.id.slice(0, 8);
}
