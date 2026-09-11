import { describe, expect, it } from "vitest";

import { resolveVisibleSprintId } from "./resolve-visible-sprint-id";

describe("resolveVisibleSprintId", () => {
    it("picks the intersecting sprint closest to the top of the scrollport", () => {
        expect(
            resolveVisibleSprintId(
                [
                    {
                        id: "later",
                        intersecting: true,
                        ratio: 0.9,
                        top: 420,
                    },
                    {
                        id: "here",
                        intersecting: true,
                        ratio: 0.35,
                        top: 24,
                    },
                ],
                null
            )
        ).toBe("here");
    });

    it("keeps the fallback when nothing intersects", () => {
        expect(
            resolveVisibleSprintId(
                [
                    {
                        id: "past",
                        intersecting: false,
                        ratio: 0,
                        top: -200,
                    },
                ],
                "past"
            )
        ).toBe("past");
    });

    it("breaks a top tie with the higher intersection ratio", () => {
        expect(
            resolveVisibleSprintId(
                [
                    {
                        id: "low",
                        intersecting: true,
                        ratio: 0.2,
                        top: 16,
                    },
                    {
                        id: "high",
                        intersecting: true,
                        ratio: 0.8,
                        top: 16,
                    },
                ],
                null
            )
        ).toBe("high");
    });
});
