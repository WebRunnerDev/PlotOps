import { describe, expect, it } from "vitest";

import { computeSprintTimeline } from "./compute-sprint-timeline";

describe("computeSprintTimeline", () => {
    it("returns undated when startsOn or endsOn missing", () => {
        expect(
            computeSprintTimeline({
                endsOn: null,
                startsOn: "2026-09-01",
                today: "2026-09-04",
            })
        ).toEqual({
            daysElapsed: null,
            daysRemaining: null,
            phase: "undated",
            progress01: null,
            totalDays: null,
        });
    });

    it("treats today before start as upcoming with full remaining", () => {
        expect(
            computeSprintTimeline({
                endsOn: "2026-09-14",
                startsOn: "2026-09-08",
                today: "2026-09-04",
            })
        ).toEqual({
            daysElapsed: 0,
            daysRemaining: 10,
            phase: "upcoming",
            progress01: 0,
            totalDays: 7,
        });
    });

    it("computes mid-sprint progress inclusively", () => {
        // Sep 1–7 inclusive = 7 days; Sep 4 = day 4 elapsed → 3 remaining
        expect(
            computeSprintTimeline({
                endsOn: "2026-09-07",
                startsOn: "2026-09-01",
                today: "2026-09-04",
            })
        ).toEqual({
            daysElapsed: 3,
            daysRemaining: 3,
            phase: "active",
            progress01: 3 / 6,
            totalDays: 7,
        });
    });

    it("marks overdue when past endsOn", () => {
        expect(
            computeSprintTimeline({
                endsOn: "2026-09-01",
                startsOn: "2026-08-25",
                today: "2026-09-04",
            })
        ).toMatchObject({
            daysRemaining: 0,
            phase: "overdue",
            progress01: 1,
        });
    });

    it("clamps single-day sprint", () => {
        expect(
            computeSprintTimeline({
                endsOn: "2026-09-04",
                startsOn: "2026-09-04",
                today: "2026-09-04",
            })
        ).toEqual({
            daysElapsed: 0,
            daysRemaining: 0,
            phase: "active",
            progress01: 1,
            totalDays: 1,
        });
    });
});
