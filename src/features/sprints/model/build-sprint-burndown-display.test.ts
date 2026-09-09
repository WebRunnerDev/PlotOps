import { describe, expect, it } from "vitest";

import type { SprintBurndownSeries } from "./build-sprint-burndown-series";

import { buildSprintBurndownDisplayPoints } from "./build-sprint-burndown-display";

function seriesFromDays(
    days: SprintBurndownSeries["days"],
    commitmentTotal: number
): SprintBurndownSeries {
    return {
        commitmentTotal,
        days,
        metric: "count",
        unestimatedCount: commitmentTotal,
    };
}

describe("buildSprintBurndownDisplayPoints", () => {
    it("trims flat post-close calendar days on closed sprints", () => {
        const series = seriesFromDays(
            [
                {
                    completedCumulative: 0,
                    date: "2026-09-02",
                    ideal: 56,
                    idealCompleted: 0,
                    remaining: 56,
                    scope: 56,
                },
                {
                    completedCumulative: 50,
                    date: "2026-09-03",
                    ideal: 48,
                    idealCompleted: 8,
                    remaining: 6,
                    scope: 56,
                },
                {
                    completedCumulative: 50,
                    date: "2026-09-04",
                    ideal: 40,
                    idealCompleted: 16,
                    remaining: 6,
                    scope: 56,
                },
                {
                    completedCumulative: 50,
                    date: "2026-09-09",
                    ideal: 0,
                    idealCompleted: 56,
                    remaining: 6,
                    scope: 56,
                },
            ],
            56
        );

        const points = buildSprintBurndownDisplayPoints(series, "closed");
        expect(points.map((point) => point.remaining)).toEqual([56, 6]);
        expect(points).toHaveLength(2);
    });

    it("synthesizes an open→close cliff when closed on day one", () => {
        const series = seriesFromDays(
            [
                {
                    completedCumulative: 50,
                    date: "2026-09-02",
                    ideal: 56,
                    idealCompleted: 0,
                    remaining: 6,
                    scope: 56,
                },
                {
                    completedCumulative: 50,
                    date: "2026-09-03",
                    ideal: 48,
                    idealCompleted: 8,
                    remaining: 6,
                    scope: 56,
                },
                {
                    completedCumulative: 50,
                    date: "2026-09-09",
                    ideal: 0,
                    idealCompleted: 56,
                    remaining: 6,
                    scope: 56,
                },
            ],
            56
        );

        const points = buildSprintBurndownDisplayPoints(series, "closed");
        expect(points).toHaveLength(2);
        expect(points[0]?.remaining).toBe(56);
        expect(points[1]?.remaining).toBe(6);
        expect(points[0]!.date.getTime()).toBeLessThan(
            points[1]!.date.getTime()
        );
    });
});
