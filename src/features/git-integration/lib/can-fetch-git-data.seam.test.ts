import { describe, expect, it } from "vitest";

import {
    canFetchGitData,
    canFetchPullRequestFiles,
} from "@/features/git-integration/lib/can-fetch-git-data";

describe("canFetchGitData", () => {
    it("allows guests to load git data without a token", () => {
        expect(
            canFetchGitData({
                branchName: "feature/demo",
                isGuest: true,
                repoFullName: "demo/plotops",
                token: null,
            })
        ).toBe(true);
    });

    it("requires a token for non-guest sessions", () => {
        expect(
            canFetchGitData({
                branchName: "feature/demo",
                isGuest: false,
                repoFullName: "demo/plotops",
                token: null,
            })
        ).toBe(false);

        expect(
            canFetchGitData({
                branchName: "feature/demo",
                isGuest: false,
                repoFullName: "demo/plotops",
                token: "ghp_test",
            })
        ).toBe(true);
    });

    it("stays off when repo or branch is missing", () => {
        expect(
            canFetchGitData({
                branchName: undefined,
                isGuest: true,
                repoFullName: "demo/plotops",
                token: null,
            })
        ).toBe(false);

        expect(
            canFetchGitData({
                branchName: "feature/demo",
                isGuest: true,
                repoFullName: undefined,
                token: null,
            })
        ).toBe(false);
    });
});

describe("canFetchPullRequestFiles", () => {
    it("allows guests to open diffs without a token", () => {
        expect(
            canFetchPullRequestFiles({
                isGuest: true,
                prNumber: 42,
                repoFullName: "demo/plotops",
                token: null,
            })
        ).toBe(true);
    });

    it("requires a token for non-guest sessions", () => {
        expect(
            canFetchPullRequestFiles({
                isGuest: false,
                prNumber: 42,
                repoFullName: "demo/plotops",
                token: null,
            })
        ).toBe(false);
    });
});
