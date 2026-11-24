import type {
    FlowColumn,
    FlowHistory,
} from "@/features/flow-reports/model/types";

import {
    buildTaskTimelines,
    columnAt,
} from "@/features/flow-reports/model/build-task-timelines";

export type CumulativeFlow = {
    columns: FlowColumn[];
    days: CumulativeFlowDay[];
};

export type CumulativeFlowDay = {
    /** Instant the counts were taken: end of day, or now for today. */
    at: number;
    /** Tasks per column (Board order) at the end of the day. */
    counts: number[];
    /** Local calendar date `YYYY-MM-DD`. */
    date: string;
};

/**
 * Cumulative flow: how many Tasks sat in each column of the Board at the end
 * of each of the last `rangeDays` local days (today counts as of now).
 */
export function buildCumulativeFlow(input: {
    columns: ReadonlyArray<FlowColumn>;
    history: FlowHistory;
    now: Date;
    rangeDays: number;
}): CumulativeFlow {
    const columns = [...input.columns];
    if (columns.length === 0) return { columns, days: [] };

    const timelines = buildTaskTimelines({
        columns,
        history: input.history,
    });
    const nowMs = input.now.getTime();
    const days: CumulativeFlowDay[] = [];

    for (let offset = input.rangeDays - 1; offset >= 0; offset -= 1) {
        const day = new Date(input.now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - offset);
        const endOfDay = new Date(day);
        endOfDay.setDate(endOfDay.getDate() + 1);
        const at = Math.min(endOfDay.getTime() - 1, nowMs);

        const counts = columns.map(() => 0);
        for (const timeline of timelines) {
            const column = columnAt(timeline, at);
            if (column !== null) counts[column] = (counts[column] ?? 0) + 1;
        }
        days.push({ at, counts, date: localIsoDate(day) });
    }

    return { columns, days };
}

/** Start of the report window: local midnight `rangeDays - 1` days ago. */
export function flowRangeStart(now: Date, rangeDays: number): Date {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (rangeDays - 1));
    return start;
}

/** Local calendar date `YYYY-MM-DD`. */
export function localIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
