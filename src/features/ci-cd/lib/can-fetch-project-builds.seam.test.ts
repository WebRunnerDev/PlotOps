import { describe, expect, it } from "vitest";

import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";

describe("canFetchProjectBuilds", () => {
    it("allows guests to load builds without a GitHub token when a repo is linked", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                isGuest: true,
                projectId: "proj-demo",
                repositoryCount: 1,
            })
        ).toBe(true);
    });

    it("requires a token for non-guest sessions", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                isGuest: false,
                projectId: "proj-demo",
                repositoryCount: 1,
            })
        ).toBe(false);

        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                isGuest: false,
                projectId: "proj-demo",
                repositoryCount: 1,
            })
        ).toBe(true);
    });

    it("stays off when projectId is missing", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                isGuest: true,
                projectId: "",
                repositoryCount: 1,
            })
        ).toBe(false);
    });

    it("stays off when the Project has no Repository (name-only)", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                isGuest: false,
                projectId: "proj-plain",
                repositoryCount: 0,
            })
        ).toBe(false);

        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                isGuest: true,
                projectId: "proj-plain",
                repositoryCount: 0,
            })
        ).toBe(false);
    });
});
