import { isTaskEstimate } from "@/features/tasks";

import type { SprintEventType, SprintState } from "./types";

export type BurndownMetric = "count" | "points";

export type SprintBurndownDay = {
    /** Completed work cumulative; null for calendar days after asOfDate. */
    completedCumulative: null | number;
    date: string;
    /** Ideal remaining (burndown guideline). */
    ideal: number;
    /** Ideal completed (burnup guideline from 0 → commitment). */
    idealCompleted: number;
    /** Remaining work; null for calendar days after asOfDate. */
    remaining: null | number;
    /** In-sprint scope (membership measure); null after asOfDate. */
    scope: null | number;
};

export type SprintBurndownEmptyReason =
    "canceled" | "missing_dates" | "not_started";

export type SprintBurndownEvent = {
    createdAt: string;
    eventType: SprintEventType;
    taskId?: string;
};

export type SprintBurndownSeries = {
    commitmentTotal: number;
    days: SprintBurndownDay[];
    emptyReason?: SprintBurndownEmptyReason;
    metric: BurndownMetric;
    unestimatedCount: number;
};

export type SprintBurndownTask = {
    estimate?: null | number;
    id: string;
    status: string;
};

/**
 * Pure burndown series from Commitment + scope events.
 * Active remaining uses current Done-column proxy; Closed drops completed
 * on/after closedOn. Metric prefers points when any in-scope Estimate exists.
 */
export function buildSprintBurndownSeries(input: {
    asOfDate: string;
    closedOn?: string;
    committedTaskIds: readonly string[];
    completedTaskIds: readonly string[];
    doneColumnIds: ReadonlySet<string>;
    endsOn?: string;
    events: readonly SprintBurndownEvent[];
    startsOn?: string;
    state: SprintState;
    tasks: readonly SprintBurndownTask[];
}): SprintBurndownSeries {
    if (input.state === "canceled") {
        return emptySeries("canceled");
    }
    if (input.state === "draft") {
        return emptySeries("not_started");
    }
    if (!input.startsOn || !input.endsOn) {
        return emptySeries("missing_dates");
    }

    const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
    const dates = eachIsoDateInclusive(input.startsOn, input.endsOn);
    const knownIds = collectKnownTaskIds(input.committedTaskIds, input.events);
    const { metric, unestimatedCount } = resolveMetric(knownIds, tasksById);
    const commitmentTotal = measureIds(
        input.committedTaskIds,
        metric,
        tasksById
    );
    const lastIndex = Math.max(dates.length - 1, 0);
    const completed = new Set(input.completedTaskIds);
    const scopeEvents = [...input.events]
        .filter(
            (event) =>
                (event.eventType === "task_added" ||
                    event.eventType === "task_removed") &&
                Boolean(event.taskId)
        )
        .toSorted((left, right) =>
            left.createdAt.localeCompare(right.createdAt)
        );

    const days: SprintBurndownDay[] = dates.map((date, index) => {
        const ideal =
            lastIndex === 0
                ? 0
                : commitmentTotal * ((lastIndex - index) / lastIndex);
        const idealCompleted =
            lastIndex === 0
                ? commitmentTotal
                : commitmentTotal * (index / lastIndex);
        if (date > input.asOfDate) {
            return {
                completedCumulative: null,
                date,
                ideal: roundMetric(ideal),
                idealCompleted: roundMetric(idealCompleted),
                remaining: null,
                scope: null,
            };
        }
        const members = membershipAsOf(
            input.committedTaskIds,
            scopeEvents,
            date
        );
        const scope = measureIds(members, metric, tasksById);
        const remaining = measureRemainingFromMembers({
            closedOn: input.closedOn,
            completed,
            date,
            doneColumnIds: input.doneColumnIds,
            members,
            metric,
            state: input.state,
            tasksById,
        });
        const completedCumulative = Math.max(0, scope - remaining);

        return {
            completedCumulative: roundMetric(completedCumulative),
            date,
            ideal: roundMetric(ideal),
            idealCompleted: roundMetric(idealCompleted),
            remaining: roundMetric(remaining),
            scope: roundMetric(scope),
        };
    });

    return {
        commitmentTotal: roundMetric(commitmentTotal),
        days,
        metric,
        unestimatedCount,
    };
}

function addIsoDays(isoDate: string, days: number): string {
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(year!, month! - 1, day!);
    date.setDate(date.getDate() + days);
    return localIsoDate(date);
}

function collectKnownTaskIds(
    committedTaskIds: readonly string[],
    events: readonly SprintBurndownEvent[]
): string[] {
    const ids = new Set(committedTaskIds);
    for (const event of events) {
        if (event.taskId) ids.add(event.taskId);
    }
    return [...ids];
}

function eachIsoDateInclusive(startsOn: string, endsOn: string): string[] {
    const dates: string[] = [];
    let cursor = startsOn;
    while (cursor <= endsOn) {
        dates.push(cursor);
        cursor = addIsoDays(cursor, 1);
    }
    return dates;
}

function emptySeries(reason: SprintBurndownEmptyReason): SprintBurndownSeries {
    return {
        commitmentTotal: 0,
        days: [],
        emptyReason: reason,
        metric: "count",
        unestimatedCount: 0,
    };
}

function eventDay(createdAt: string): string {
    return localIsoDate(new Date(createdAt));
}

function localIsoDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function measureIds(
    ids: readonly string[],
    metric: BurndownMetric,
    tasksById: ReadonlyMap<string, SprintBurndownTask>
): number {
    if (metric === "count") return ids.length;
    let sum = 0;
    for (const id of ids) {
        const estimate = tasksById.get(id)?.estimate;
        if (isTaskEstimate(estimate)) sum += estimate;
    }
    return sum;
}

function measureRemainingFromMembers(input: {
    closedOn?: string;
    completed: ReadonlySet<string>;
    date: string;
    doneColumnIds: ReadonlySet<string>;
    members: readonly string[];
    metric: BurndownMetric;
    state: SprintState;
    tasksById: ReadonlyMap<string, SprintBurndownTask>;
}): number {
    const remainingIds =
        input.state === "closed"
            ? input.members.filter((id) => {
                  if (input.closedOn && input.date >= input.closedOn) {
                      return !input.completed.has(id);
                  }
                  return true;
              })
            : input.members.filter((id) => {
                  const task = input.tasksById.get(id);
                  if (!task) return true;
                  return !input.doneColumnIds.has(task.status);
              });

    return measureIds(remainingIds, input.metric, input.tasksById);
}

function membershipAsOf(
    committedTaskIds: readonly string[],
    events: readonly SprintBurndownEvent[],
    date: string
): string[] {
    const members = new Set(committedTaskIds);
    for (const event of events) {
        if (eventDay(event.createdAt) > date) continue;
        const taskId = event.taskId;
        if (!taskId) continue;
        if (event.eventType === "task_added") members.add(taskId);
        if (event.eventType === "task_removed") members.delete(taskId);
    }
    return [...members];
}

function resolveMetric(
    knownIds: readonly string[],
    tasksById: ReadonlyMap<string, SprintBurndownTask>
): { metric: BurndownMetric; unestimatedCount: number } {
    let estimatedCount = 0;
    let unestimatedCount = 0;
    for (const id of knownIds) {
        if (isTaskEstimate(tasksById.get(id)?.estimate)) {
            estimatedCount += 1;
        } else {
            unestimatedCount += 1;
        }
    }
    return {
        metric: estimatedCount > 0 ? "points" : "count",
        unestimatedCount,
    };
}

function roundMetric(value: number): number {
    return Math.round(value * 100) / 100;
}
