import { describe, expect, it } from "vitest";

import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";

describe("canFetchProjectBuilds", () => {
    it("allows guests to load builds without a GitHub token when a repo is linked", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                githubRepoId: 999_000_001,
                isGuest: true,
                projectId: "proj-demo",
            })
        ).toBe(true);
    });

    it("requires a token for non-guest sessions", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                githubRepoId: 1,
                isGuest: false,
                projectId: "proj-demo",
            })
        ).toBe(false);

        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                githubRepoId: 1,
                isGuest: false,
                projectId: "proj-demo",
            })
        ).toBe(true);
    });

    it("stays off when projectId is missing", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                githubRepoId: 1,
                isGuest: true,
                projectId: "",
            })
        ).toBe(false);
    });

    it("stays off when the Project has no github_repo_id (name-only)", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                githubRepoId: null,
                isGuest: false,
                projectId: "proj-plain",
            })
        ).toBe(false);

        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                githubRepoId: undefined,
                isGuest: true,
                projectId: "proj-plain",
            })
        ).toBe(false);
    });
});
