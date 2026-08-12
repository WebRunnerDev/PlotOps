import { describe, expect, it } from "vitest";

import { buildSprintKpis } from "./build-sprint-kpis";

describe("sprint KPIs seam", () => {
    it("computes velocity and commitment accuracy from last N Closed sprints", () => {
        const kpis = buildSprintKpis({
            closedSprints: [
                {
                    closedAt: "2026-03-10T12:00:00.000Z",
                    committedTaskIds: ["a", "b"],
                    completedTaskIds: ["a"],
                    id: "s1",
                },
                {
                    closedAt: "2026-03-20T12:00:00.000Z",
                    committedTaskIds: ["c", "d"],
                    completedTaskIds: ["c", "d"],
                    id: "s2",
                },
                {
                    closedAt: "2026-03-30T12:00:00.000Z",
                    committedTaskIds: ["e"],
                    completedTaskIds: ["e"],
                    id: "s3",
                },
            ],
            lastN: 2,
            tasks: [
                { estimate: 5, id: "a" },
                { estimate: 3, id: "b" },
                { estimate: 8, id: "c" },
                { estimate: 2, id: "d" },
                { estimate: 13, id: "e" },
            ],
        });

        // lastN=2 → s3 then s2 (most recent Closed)
        // completed: 13, 10 → velocity avg 11.5
        // committed total 8+2+13=23, completed 8+2+13=23 → accuracy 1
        expect(kpis.emptyReason).toBeUndefined();
        expect(kpis.metric).toBe("points");
        expect(kpis.sampleSize).toBe(2);
        expect(kpis.windowSize).toBe(2);
        expect(kpis.velocity).toBe(11.5);
        expect(kpis.commitmentAccuracy).toBe(1);
    });

    it("falls back to task count when no Estimates exist in the window", () => {
        const kpis = buildSprintKpis({
            closedSprints: [
                {
                    closedAt: "2026-03-10T12:00:00.000Z",
                    committedTaskIds: ["a", "b", "c"],
                    completedTaskIds: ["a", "b"],
                    id: "s1",
                },
                {
                    closedAt: "2026-03-20T12:00:00.000Z",
                    committedTaskIds: ["d"],
                    completedTaskIds: ["d"],
                    id: "s2",
                },
            ],
            tasks: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
        });

        // velocity: avg(2, 1) = 1.5; accuracy: 3/4 = 0.75
        expect(kpis.metric).toBe("count");
        expect(kpis.velocity).toBe(1.5);
        expect(kpis.commitmentAccuracy).toBe(0.75);
    });

    it("returns empty when there are no Closed sprints", () => {
        const kpis = buildSprintKpis({
            closedSprints: [],
            tasks: [],
        });

        expect(kpis.emptyReason).toBe("no_closed_sprints");
        expect(kpis.velocity).toBeNull();
        expect(kpis.commitmentAccuracy).toBeNull();
        expect(kpis.sampleSize).toBe(0);
    });

    it("keeps commitment accuracy null when sampled Commitment totals are zero", () => {
        const kpis = buildSprintKpis({
            closedSprints: [
                {
                    closedAt: "2026-03-10T12:00:00.000Z",
                    committedTaskIds: [],
                    completedTaskIds: [],
                    id: "s1",
                },
            ],
            tasks: [],
        });

        expect(kpis.emptyReason).toBeUndefined();
        expect(kpis.sampleSize).toBe(1);
        expect(kpis.velocity).toBe(0);
        expect(kpis.commitmentAccuracy).toBeNull();
    });
});
