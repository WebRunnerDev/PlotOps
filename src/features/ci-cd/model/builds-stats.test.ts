import { describe, expect, it } from "vitest";

import { deriveBuildsStats } from "@/features/ci-cd/model/builds-stats";

describe("deriveBuildsStats", () => {
    it("splits completed runs into success and failure", () => {
        expect(
            deriveBuildsStats({ completed: 100, success: 82, total: 100 })
        ).toEqual({ failure: 18, running: 0, success: 82, total: 100 });
    });

    it("counts everything not completed as running", () => {
        expect(
            deriveBuildsStats({ completed: 40, success: 40, total: 43 })
        ).toEqual({ failure: 0, running: 3, success: 40, total: 43 });
    });

    it("clamps buckets that disagree mid-flight", () => {
        expect(
            deriveBuildsStats({ completed: 120, success: 130, total: 100 })
        ).toEqual({ failure: 0, running: 0, success: 100, total: 100 });
    });

    it("returns zeroes for an empty or unusable response", () => {
        expect(
            deriveBuildsStats({ completed: -2, success: Number.NaN, total: 0 })
        ).toEqual({ failure: 0, running: 0, success: 0, total: 0 });
    });
});
