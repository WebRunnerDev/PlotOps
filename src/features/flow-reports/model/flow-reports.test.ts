import { describe, expect, it } from "vitest";

import type {
    FlowColumn,
    FlowStatusChange,
    FlowTask,
} from "@/features/flow-reports/model/types";

import {
    buildCumulativeFlow,
    flowRangeStart,
} from "@/features/flow-reports/model/build-cumulative-flow";
import {
    buildCycleTime,
    median,
    percentileNearestRank,
} from "@/features/flow-reports/model/build-cycle-time";
import {
    createFlowColumnResolver,
    resolveDoneColumnIndex,
} from "@/features/flow-reports/model/build-task-timelines";

const COLUMNS: FlowColumn[] = [
    { id: "todo", isDone: false, name: "To Do" },
    { id: "in_progress", isDone: false, name: "In Progress" },
    { id: "done", isDone: true, name: "Done" },
];

const DAY = 86_400_000;

/** Local noon `days` days before NOW, as ISO. */
function daysAgo(days: number, hours = 12): string {
    const date = new Date(NOW);
    date.setHours(hours, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

const NOW = new Date(2026, 10, 24, 15, 0, 0);

function columnName(id: null | string): null | string {
    return COLUMNS.find((column) => column.id === id)?.name ?? null;
}

function move(
    taskId: string,
    from: null | string,
    to: string,
    at: string
): FlowStatusChange {
    return {
        changedAt: at,
        fromStatus: from,
        fromStatusName: columnName(from),
        taskId,
        toStatus: to,
        toStatusName: columnName(to),
    };
}

function task(overrides: Partial<FlowTask> & Pick<FlowTask, "id">): FlowTask {
    return {
        archivedAt: null,
        createdAt: daysAgo(60),
        key: overrides.id.toUpperCase(),
        status: "todo",
        title: overrides.id,
        ...overrides,
    };
}

describe("resolveDoneColumnIndex", () => {
    it("prefers the column marked Done, else the rightmost", () => {
        expect(resolveDoneColumnIndex(COLUMNS)).toBe(2);
        expect(
            resolveDoneColumnIndex(
                COLUMNS.map((column) => ({ ...column, isDone: false }))
            )
        ).toBe(2);
        expect(resolveDoneColumnIndex([])).toBe(-1);
    });
});

describe("createFlowColumnResolver", () => {
    const resolve = createFlowColumnResolver(COLUMNS);

    it("maps by id and name, then name, then id, else the first column", () => {
        expect(resolve("in_progress", "In Progress")).toBe(1);
        // Another Board's column with a different id but the same name.
        expect(resolve("col_x", "in progress ")).toBe(1);
        // Same id, renamed since.
        expect(resolve("done", "Shipped")).toBe(2);
        expect(resolve("col_y", "QA")).toBe(0);
        expect(resolve(null, null)).toBe(0);
    });
});

describe("buildCumulativeFlow", () => {
    it("counts Tasks per column at the end of each day", () => {
        const flow = buildCumulativeFlow({
            columns: COLUMNS,
            history: {
                changes: [
                    move("a", "todo", "in_progress", daysAgo(2)),
                    move("a", "in_progress", "done", daysAgo(1)),
                    move("b", null, "todo", daysAgo(1)),
                ],
                tasks: [
                    task({ id: "a", status: "done" }),
                    task({ createdAt: daysAgo(1), id: "b" }),
                    task({ id: "c", status: "in_progress" }),
                ],
            },
            now: NOW,
            rangeDays: 3,
        });

        expect(flow.days.map((day) => day.counts)).toEqual([
            [0, 2, 0], // a in progress, c in progress
            [1, 1, 1], // b created, a done
            [1, 1, 1],
        ]);
        expect(flow.days.at(-1)?.at).toBe(NOW.getTime());
    });

    it("drops a Task from the day it was archived", () => {
        const flow = buildCumulativeFlow({
            columns: COLUMNS,
            history: {
                changes: [],
                tasks: [task({ archivedAt: daysAgo(1), id: "a" })],
            },
            now: NOW,
            rangeDays: 3,
        });
        expect(flow.days.map((day) => day.counts[0])).toEqual([1, 0, 0]);
    });

    it("counts history from another Board by this Board's columns", () => {
        const flow = buildCumulativeFlow({
            columns: COLUMNS,
            history: {
                changes: [
                    {
                        changedAt: daysAgo(0),
                        fromStatus: "col_doing",
                        fromStatusName: "In progress",
                        taskId: "a",
                        toStatus: "todo",
                        toStatusName: "To Do",
                    },
                ],
                tasks: [task({ id: "a" })],
            },
            now: NOW,
            rangeDays: 2,
        });
        expect(flow.days.map((day) => day.counts)).toEqual([
            [0, 1, 0],
            [1, 0, 0],
        ]);
    });
});

describe("buildCycleTime", () => {
    const since = flowRangeStart(NOW, 30);

    it("measures first leaving the first column to the last entry into Done", () => {
        const cycle = buildCycleTime({
            columns: COLUMNS,
            history: {
                changes: [
                    move("a", "todo", "in_progress", daysAgo(10)),
                    move("a", "in_progress", "done", daysAgo(8)),
                    // Reopened, then done again: the last entry counts.
                    move("a", "done", "in_progress", daysAgo(7)),
                    move("a", "in_progress", "done", daysAgo(6)),
                    move("b", "todo", "in_progress", daysAgo(3)),
                    move("b", "in_progress", "done", daysAgo(2)),
                ],
                tasks: [
                    task({ id: "a", status: "done" }),
                    task({ id: "b", status: "done" }),
                ],
            },
            now: NOW,
            since,
        });

        expect(
            cycle.points.map((point) => [point.task.id, point.durationMs / DAY])
        ).toEqual([
            ["a", 4],
            ["b", 1],
        ]);
        expect(cycle.medianMs).toBe(2.5 * DAY);
        expect(cycle.p85Ms).toBe(4 * DAY);
        expect(cycle.withoutHistory).toBe(0);
    });

    it("starts at creation for a Task created in a middle column", () => {
        const cycle = buildCycleTime({
            columns: COLUMNS,
            history: {
                changes: [
                    move("a", null, "in_progress", daysAgo(5)),
                    move("a", "in_progress", "done", daysAgo(2)),
                ],
                tasks: [
                    task({ createdAt: daysAgo(5), id: "a", status: "done" }),
                ],
            },
            now: NOW,
            since,
        });
        expect(cycle.points[0]?.durationMs).toBe(3 * DAY);
    });

    it("leaves out Tasks whose start predates the history", () => {
        const cycle = buildCycleTime({
            columns: COLUMNS,
            history: {
                changes: [
                    // Known only from In Progress on: the start is unknown.
                    move("a", "in_progress", "done", daysAgo(2)),
                    // Done before the window.
                    move("b", "todo", "in_progress", daysAgo(50)),
                    move("b", "in_progress", "done", daysAgo(40)),
                    // Not Done now.
                    move("c", "todo", "in_progress", daysAgo(4)),
                ],
                tasks: [
                    task({ id: "a", status: "done" }),
                    task({ id: "b", status: "done" }),
                    task({ id: "c", status: "in_progress" }),
                ],
            },
            now: NOW,
            since,
        });
        expect(cycle.points).toEqual([]);
        expect(cycle.withoutHistory).toBe(1);
        expect(cycle.medianMs).toBeNull();
    });
});

describe("percentiles", () => {
    it("median averages the middle pair; p85 is nearest rank", () => {
        expect(median([1, 2, 3])).toBe(2);
        expect(median([1, 2, 3, 4])).toBe(2.5);
        expect(median([])).toBeNull();
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(percentileNearestRank(values, 0.85)).toBe(9);
        expect(percentileNearestRank([7], 0.85)).toBe(7);
    });
});
