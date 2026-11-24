import { describe, expect, it } from "vitest";

import { buildSprintReportSummary } from "./build-sprint-report-summary";

const columns = [
    { id: "todo", isDone: false },
    { id: "doing", isDone: false },
    { id: "done", isDone: true },
];

describe("buildSprintReportSummary", () => {
    it("reads Active completion live from Done columns", () => {
        const summary = buildSprintReportSummary({
            columns,
            events: [{ eventType: "task_added", payload: {} }],
            sprint: {
                committedTaskIds: ["a", "b"],
                completedTaskIds: [],
                id: "s1",
                state: "active",
            },
            tasks: [
                { estimate: 5, id: "a", sprintId: "s1", status: "done" },
                { estimate: 3, id: "b", sprintId: "s1", status: "doing" },
                { id: "c", sprintId: "s1", status: "done" },
                { estimate: 8, id: "x", status: "done" },
            ],
        });

        expect(summary.doneIsLive).toBe(true);
        expect(summary.metric).toBe("points");
        expect(summary.scope).toEqual({ count: 3, points: 8, unestimated: 1 });
        expect(summary.done).toEqual({ count: 2, points: 5, unestimated: 1 });
        expect(summary.remaining).toEqual({
            count: 1,
            points: 3,
            unestimated: 0,
        });
        expect(summary.committed).toEqual({
            count: 2,
            points: 8,
            unestimated: 0,
        });
        expect(summary.completion).toBeCloseTo(5 / 8);
        expect(summary.scopeAdded).toBe(1);
        expect(summary.scopeRemoved).toBe(0);
    });

    it("uses the Close snapshot and carryover for a Closed sprint", () => {
        const summary = buildSprintReportSummary({
            columns,
            events: [
                {
                    eventType: "closed",
                    payload: { carryover_by_task_id: { b: null, c: "s2" } },
                },
            ],
            sprint: {
                committedTaskIds: ["a", "b"],
                completedTaskIds: ["a"],
                id: "s1",
                state: "closed",
            },
            tasks: [
                { id: "a", sprintId: "s1", status: "done" },
                { id: "b", status: "todo" },
                { id: "c", sprintId: "s2", status: "doing" },
            ],
        });

        expect(summary.doneIsLive).toBe(false);
        expect(summary.metric).toBe("count");
        expect(summary.scope.count).toBe(3);
        expect(summary.done.count).toBe(1);
        expect(summary.remaining.count).toBe(2);
        expect(summary.completion).toBeCloseTo(1 / 3);
    });

    it("falls back to the commitment when a Closed event has no carryover", () => {
        const summary = buildSprintReportSummary({
            columns,
            events: [],
            sprint: {
                committedTaskIds: ["a", "b"],
                completedTaskIds: ["a"],
                id: "s1",
                state: "closed",
            },
            tasks: [],
        });

        expect(summary.scope.count).toBe(2);
        expect(summary.completion).toBe(0.5);
    });

    it("reports nothing done for a Canceled sprint", () => {
        const summary = buildSprintReportSummary({
            columns,
            events: [],
            sprint: {
                committedTaskIds: ["a"],
                completedTaskIds: [],
                id: "s1",
                state: "canceled",
            },
            tasks: [{ id: "a", status: "done" }],
        });

        expect(summary.done.count).toBe(0);
        expect(summary.completion).toBe(0);
    });

    it("returns null completion for an empty scope", () => {
        const summary = buildSprintReportSummary({
            columns,
            events: [],
            sprint: {
                committedTaskIds: [],
                completedTaskIds: [],
                id: "s1",
                state: "active",
            },
            tasks: [],
        });

        expect(summary.completion).toBeNull();
    });
});
