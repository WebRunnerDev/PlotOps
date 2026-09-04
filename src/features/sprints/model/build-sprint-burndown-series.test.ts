import { describe, expect, it } from "vitest";

import { buildSprintBurndownSeries } from "./build-sprint-burndown-series";

describe("sprint burndown series seam", () => {
    it("builds daily ideal and remaining points from commitment and Done proxy", () => {
        const series = buildSprintBurndownSeries({
            asOfDate: "2026-03-03",
            committedTaskIds: ["a", "b"],
            completedTaskIds: [],
            doneColumnIds: new Set(["done"]),
            endsOn: "2026-03-05",
            events: [],
            startsOn: "2026-03-01",
            state: "active",
            tasks: [
                { estimate: 5, id: "a", status: "todo" },
                { estimate: 3, id: "b", status: "done" },
            ],
        });

        expect(series.emptyReason).toBeUndefined();
        expect(series.metric).toBe("points");
        expect(series.commitmentTotal).toBe(8);
        expect(series.unestimatedCount).toBe(0);
        expect(series.days.map((day) => day.date)).toEqual([
            "2026-03-01",
            "2026-03-02",
            "2026-03-03",
            "2026-03-04",
            "2026-03-05",
        ]);
        expect(series.days.map((day) => day.ideal)).toEqual([8, 6, 4, 2, 0]);
        // Done proxy applies current status to historical membership days.
        expect(series.days.map((day) => day.remaining)).toEqual([
            5,
            5,
            5,
            null,
            null,
        ]);
        expect(series.days.map((day) => day.scope)).toEqual([
            8,
            8,
            8,
            null,
            null,
        ]);
        expect(series.days.map((day) => day.completedCumulative)).toEqual([
            3,
            3,
            3,
            null,
            null,
        ]);
        expect(series.days.map((day) => day.idealCompleted)).toEqual([
            0, 2, 4, 6, 8,
        ]);
    });

    it("applies scope add/remove on the event calendar day", () => {
        const series = buildSprintBurndownSeries({
            asOfDate: "2026-03-04",
            committedTaskIds: ["a"],
            completedTaskIds: [],
            doneColumnIds: new Set(["done"]),
            endsOn: "2026-03-04",
            events: [
                {
                    createdAt: "2026-03-02T12:00:00.000Z",
                    eventType: "task_added",
                    taskId: "b",
                },
                {
                    createdAt: "2026-03-03T12:00:00.000Z",
                    eventType: "task_removed",
                    taskId: "a",
                },
            ],
            startsOn: "2026-03-01",
            state: "active",
            tasks: [
                { estimate: 5, id: "a", status: "todo" },
                { estimate: 8, id: "b", status: "todo" },
            ],
        });

        expect(series.days.map((day) => day.remaining)).toEqual([
            5, // a
            13, // a + b
            8, // b only
            8,
        ]);
        expect(series.days.map((day) => day.scope)).toEqual([5, 13, 8, 8]);
        expect(series.days.map((day) => day.completedCumulative)).toEqual([
            0, 0, 0, 0,
        ]);
    });

    it("for Closed sprints, keeps remaining open until closedOn then drops completed", () => {
        const series = buildSprintBurndownSeries({
            asOfDate: "2026-03-04",
            closedOn: "2026-03-03",
            committedTaskIds: ["a", "b"],
            completedTaskIds: ["a"],
            doneColumnIds: new Set(["done"]),
            endsOn: "2026-03-04",
            events: [],
            startsOn: "2026-03-01",
            state: "closed",
            tasks: [
                { estimate: 5, id: "a", status: "done" },
                { estimate: 3, id: "b", status: "todo" },
            ],
        });

        expect(series.days.map((day) => day.remaining)).toEqual([
            8,
            8,
            3, // closedOn: incomplete b remains
            3,
        ]);
        expect(series.days.map((day) => day.completedCumulative)).toEqual([
            0,
            0,
            5, // closedOn: a completed
            5,
        ]);
        expect(series.days.map((day) => day.scope)).toEqual([8, 8, 8, 8]);
    });

    it("falls back to task count when no Estimates exist", () => {
        const series = buildSprintBurndownSeries({
            asOfDate: "2026-03-02",
            committedTaskIds: ["a", "b"],
            completedTaskIds: [],
            doneColumnIds: new Set(["done"]),
            endsOn: "2026-03-02",
            events: [],
            startsOn: "2026-03-01",
            state: "active",
            tasks: [
                { id: "a", status: "todo" },
                { id: "b", status: "done" },
            ],
        });

        expect(series.metric).toBe("count");
        expect(series.commitmentTotal).toBe(2);
        expect(series.unestimatedCount).toBe(2);
        expect(series.days.map((day) => day.remaining)).toEqual([1, 1]);
    });

    it("returns empty reasons for missing dates, drafts, and canceled", () => {
        expect(
            buildSprintBurndownSeries({
                asOfDate: "2026-03-01",
                committedTaskIds: [],
                completedTaskIds: [],
                doneColumnIds: new Set(),
                events: [],
                state: "draft",
                tasks: [],
            }).emptyReason
        ).toBe("not_started");

        expect(
            buildSprintBurndownSeries({
                asOfDate: "2026-03-01",
                committedTaskIds: [],
                completedTaskIds: [],
                doneColumnIds: new Set(),
                events: [],
                state: "canceled",
                tasks: [],
            }).emptyReason
        ).toBe("canceled");

        expect(
            buildSprintBurndownSeries({
                asOfDate: "2026-03-01",
                committedTaskIds: ["a"],
                completedTaskIds: [],
                doneColumnIds: new Set(),
                events: [],
                state: "active",
                tasks: [{ id: "a", status: "todo" }],
            }).emptyReason
        ).toBe("missing_dates");
    });
});
