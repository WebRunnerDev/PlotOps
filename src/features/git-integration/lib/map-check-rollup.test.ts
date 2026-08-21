import { describe, expect, it } from "vitest";

import type { GitCheckRun } from "@/features/git-integration/api/github-git-api";

import { mapCheckRollup } from "@/features/git-integration/lib/map-check-rollup";

function check(
    partial: Partial<GitCheckRun> & Pick<GitCheckRun, "id" | "name">
): GitCheckRun {
    return {
        completedAt: null,
        conclusion: null,
        detailsUrl: null,
        htmlUrl: "https://github.com/org/repo/runs/1",
        startedAt: null,
        status: "queued",
        ...partial,
    };
}

describe("mapCheckRollup", () => {
    it("returns neutral for an empty list", () => {
        expect(mapCheckRollup([])).toBe("neutral");
    });

    it("returns failure when any check failed", () => {
        expect(
            mapCheckRollup([
                check({
                    conclusion: "success",
                    id: 1,
                    name: "CI",
                    status: "completed",
                }),
                check({
                    conclusion: "failure",
                    id: 2,
                    name: "lint",
                    status: "completed",
                }),
            ])
        ).toBe("failure");
    });

    it("treats timed_out, cancelled, and action_required as failure", () => {
        for (const conclusion of [
            "timed_out",
            "cancelled",
            "action_required",
        ] as const) {
            expect(
                mapCheckRollup([
                    check({
                        conclusion,
                        id: 1,
                        name: "gate",
                        status: "completed",
                    }),
                ])
            ).toBe("failure");
        }
    });

    it("returns pending when any check is still running", () => {
        expect(
            mapCheckRollup([
                check({
                    conclusion: "success",
                    id: 1,
                    name: "CI",
                    status: "completed",
                }),
                check({
                    conclusion: null,
                    id: 2,
                    name: "Agent",
                    status: "in_progress",
                }),
            ])
        ).toBe("pending");
    });

    it("returns pending when conclusion is still null", () => {
        expect(
            mapCheckRollup([
                check({
                    conclusion: null,
                    id: 1,
                    name: "CI",
                    status: "completed",
                }),
            ])
        ).toBe("pending");
    });

    it("returns success when all completed checks passed", () => {
        expect(
            mapCheckRollup([
                check({
                    conclusion: "success",
                    id: 1,
                    name: "CI",
                    status: "completed",
                }),
                check({
                    conclusion: "skipped",
                    id: 2,
                    name: "optional",
                    status: "completed",
                }),
            ])
        ).toBe("success");
    });
});
