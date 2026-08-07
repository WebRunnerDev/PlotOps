import { describe, expect, it } from "vitest";

import { summarizeTaskEstimates } from "@/features/sprints/model/summarize-task-estimates";

describe("sprint estimate aggregate seam", () => {
    it("sums points and counts unestimated Tasks", () => {
        const summary = summarizeTaskEstimates([
            { estimate: 5 },
            { estimate: 3 },
            { estimate: undefined },
            { estimate: null },
            { estimate: 8 },
        ]);

        expect(summary).toEqual({
            estimatedCount: 3,
            pointsSum: 16,
            taskCount: 5,
            unestimatedCount: 2,
        });
    });

    it("reports all unestimated when no points are set", () => {
        expect(summarizeTaskEstimates([{ estimate: undefined }, {}])).toEqual({
            estimatedCount: 0,
            pointsSum: 0,
            taskCount: 2,
            unestimatedCount: 2,
        });
    });

    it("handles an empty task list", () => {
        expect(summarizeTaskEstimates([])).toEqual({
            estimatedCount: 0,
            pointsSum: 0,
            taskCount: 0,
            unestimatedCount: 0,
        });
    });
});
