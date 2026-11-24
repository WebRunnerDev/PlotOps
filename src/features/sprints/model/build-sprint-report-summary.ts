import type { SprintEvent, SprintState } from "@/features/sprints/model/types";

import { suggestedCompletedTaskIds } from "@/features/sprints/model/suggested-completed-task-ids";
import { isTaskEstimate } from "@/features/tasks";

export type SprintReportMeasure = {
    count: number;
    points: number;
    /** Tasks in this measure without an Estimate (omitted from points). */
    unestimated: number;
};

export type SprintReportMetric = "count" | "points";

export type SprintReportSummary = {
    /** Committed at Start (snapshot). */
    committed: SprintReportMeasure;
    /** done ÷ scope in the primary metric (0–1); null when scope is empty. */
    completion: null | number;
    /**
     * Active: members sitting in a Done column right now (live).
     * Closed: the Sprint completion snapshot chosen at Close.
     */
    done: SprintReportMeasure;
    /** True when `done` is a live reading of Board columns, not a snapshot. */
    doneIsLive: boolean;
    /** Points when any in-scope Task carries an Estimate, else task count. */
    metric: SprintReportMetric;
    remaining: SprintReportMeasure;
    /**
     * Active: current member Tasks.
     * Closed: completed ∪ Tasks carried over at Close.
     */
    scope: SprintReportMeasure;
    scopeAdded: number;
    scopeRemoved: number;
};

type ReportTask = {
    estimate?: null | number;
    id: string;
    sprintId?: string;
    status: string;
};

/**
 * Numbers for a Sprint report (backlog panel and the Sprints page).
 * Pure so it can be shared and tested; estimates use today's values.
 */
export function buildSprintReportSummary(input: {
    columns: ReadonlyArray<{ id: string; isDone: boolean }>;
    events: ReadonlyArray<Pick<SprintEvent, "eventType" | "payload">>;
    sprint: {
        committedTaskIds: readonly string[];
        completedTaskIds: readonly string[];
        id: string;
        state: SprintState;
    };
    tasks: readonly ReportTask[];
}): SprintReportSummary {
    const { sprint } = input;
    const tasksById = new Map(input.tasks.map((task) => [task.id, task]));

    let scopeIds: string[];
    let doneIds: string[];
    const doneIsLive = sprint.state === "active";

    if (sprint.state === "closed") {
        const closedEvent = input.events.find(
            (event) => event.eventType === "closed"
        );
        const carriedIds = carryoverTaskIds(
            closedEvent?.payload?.carryover_by_task_id
        );
        doneIds = [...sprint.completedTaskIds];
        scopeIds = unique([
            ...sprint.completedTaskIds,
            ...(carriedIds ?? sprint.committedTaskIds),
        ]);
    } else if (sprint.state === "canceled") {
        doneIds = [];
        scopeIds = [...sprint.committedTaskIds];
    } else {
        const members = input.tasks.filter(
            (task) => task.sprintId === sprint.id
        );
        scopeIds = members.map((task) => task.id);
        doneIds =
            sprint.state === "active"
                ? [
                      ...suggestedCompletedTaskIds({
                          columns: input.columns,
                          tasks: members,
                      }),
                  ]
                : [];
    }

    const doneSet = new Set(doneIds);
    const remainingIds = scopeIds.filter((id) => !doneSet.has(id));

    const committed = measure(sprint.committedTaskIds, tasksById);
    const scope = measure(scopeIds, tasksById);
    const done = measure(doneIds, tasksById);
    const remaining = measure(remainingIds, tasksById);

    const metric: SprintReportMetric =
        scope.count - scope.unestimated > 0 ||
        committed.count - committed.unestimated > 0
            ? "points"
            : "count";
    const scopeTotal = metric === "points" ? scope.points : scope.count;
    const doneTotal = metric === "points" ? done.points : done.count;

    return {
        committed,
        completion: scopeTotal > 0 ? Math.min(1, doneTotal / scopeTotal) : null,
        done,
        doneIsLive,
        metric,
        remaining,
        scope,
        scopeAdded: input.events.filter(
            (event) => event.eventType === "task_added"
        ).length,
        scopeRemoved: input.events.filter(
            (event) => event.eventType === "task_removed"
        ).length,
    };
}

/** Primary number of a measure in the report's metric. */
export function measureValue(
    value: SprintReportMeasure,
    metric: SprintReportMetric
): number {
    return metric === "points" ? value.points : value.count;
}

function carryoverTaskIds(map: unknown): null | string[] {
    if (map === null || typeof map !== "object" || Array.isArray(map)) {
        return null;
    }
    return Object.keys(map);
}

function measure(
    ids: readonly string[],
    tasksById: ReadonlyMap<string, ReportTask>
): SprintReportMeasure {
    let points = 0;
    let unestimated = 0;
    for (const id of ids) {
        const estimate = tasksById.get(id)?.estimate;
        if (isTaskEstimate(estimate)) points += estimate;
        else unestimated += 1;
    }
    return { count: ids.length, points, unestimated };
}

function unique(ids: readonly string[]): string[] {
    return [...new Set(ids)];
}
