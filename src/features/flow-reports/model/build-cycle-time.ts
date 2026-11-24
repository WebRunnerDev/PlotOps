import type {
    FlowColumn,
    FlowHistory,
    FlowTask,
} from "@/features/flow-reports/model/types";

import {
    buildTaskTimelines,
    resolveDoneColumnIndex,
    type TaskTimeline,
} from "@/features/flow-reports/model/build-task-timelines";

export type CycleTime = {
    medianMs: null | number;
    /** 85th percentile (nearest rank), ms; null without points. */
    p85Ms: null | number;
    points: CycleTimePoint[];
    /**
     * Tasks that reached Done in the window but whose start predates the
     * recorded history: shown without a Cycle time.
     */
    withoutHistory: number;
};

export type CycleTimePoint = {
    completedAt: number;
    durationMs: number;
    startedAt: number;
    task: FlowTask;
};

/**
 * Cycle time of every Task that reached the Board's Done column inside the
 * window: from first leaving the first column to the last entry into Done.
 * A Task created straight into a middle column starts at creation, when
 * that creation was recorded.
 */
export function buildCycleTime(input: {
    columns: ReadonlyArray<FlowColumn>;
    history: FlowHistory;
    now: Date;
    since: Date;
}): CycleTime {
    const doneIndex = resolveDoneColumnIndex(input.columns);
    if (doneIndex < 0) {
        return { medianMs: null, p85Ms: null, points: [], withoutHistory: 0 };
    }

    const sinceMs = input.since.getTime();
    const nowMs = input.now.getTime();
    const points: CycleTimePoint[] = [];
    let withoutHistory = 0;

    for (const timeline of buildTaskTimelines(input)) {
        const lastColumn =
            timeline.steps.at(-1)?.column ?? timeline.initialColumn;
        if (lastColumn !== doneIndex) continue;

        const completedAt = lastEntryInto(timeline, doneIndex);
        if (completedAt === null) continue;
        if (completedAt < sinceMs || completedAt > nowMs) continue;

        const startedAt = startOf(timeline, doneIndex);
        if (startedAt === null || startedAt > completedAt) {
            withoutHistory += 1;
            continue;
        }

        points.push({
            completedAt,
            durationMs: completedAt - startedAt,
            startedAt,
            task: timeline.task,
        });
    }

    const durations = points
        .map((point) => point.durationMs)
        .toSorted((a, b) => a - b);

    return {
        medianMs: median(durations),
        p85Ms: percentileNearestRank(durations, 0.85),
        points: points.toSorted((a, b) => a.completedAt - b.completedAt),
        withoutHistory,
    };
}

/** Median of ascending values; null when empty. */
export function median(sorted: readonly number[]): null | number {
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle]!
        : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Nearest-rank percentile of ascending values: the smallest value with at
 * least `p` of the values at or below it. Null when empty.
 */
export function percentileNearestRank(
    sorted: readonly number[],
    p: number
): null | number {
    if (sorted.length === 0) return null;
    const rank = Math.max(1, Math.ceil(p * sorted.length));
    return sorted[Math.min(rank, sorted.length) - 1]!;
}

function lastEntryInto(timeline: TaskTimeline, column: number): null | number {
    for (let index = timeline.steps.length - 1; index >= 0; index -= 1) {
        const step = timeline.steps[index]!;
        if (step.column === column) {
            const previous =
                index === 0
                    ? timeline.initialColumn
                    : timeline.steps[index - 1]!.column;
            if (previous !== column) return step.at;
        }
    }
    return null;
}

function startOf(timeline: TaskTimeline, doneIndex: number): null | number {
    if (
        timeline.hasCreation &&
        timeline.initialColumn !== 0 &&
        timeline.initialColumn !== doneIndex
    ) {
        return timeline.existsFrom;
    }
    let previous = timeline.initialColumn;
    for (const step of timeline.steps) {
        if (previous === 0 && step.column !== 0) return step.at;
        previous = step.column;
    }
    return null;
}
