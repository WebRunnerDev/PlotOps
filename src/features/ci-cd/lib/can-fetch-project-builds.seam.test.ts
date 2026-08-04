import { describe, expect, it } from "vitest";

import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";

describe("canFetchProjectBuilds", () => {
    it("allows guests to load builds without a GitHub token", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                isGuest: true,
                projectId: "proj-demo",
            })
        ).toBe(true);
    });

    it("requires a token for non-guest sessions", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: null,
                isGuest: false,
                projectId: "proj-demo",
            })
        ).toBe(false);

        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                isGuest: false,
                projectId: "proj-demo",
            })
        ).toBe(true);
    });

    it("stays off when projectId is missing", () => {
        expect(
            canFetchProjectBuilds({
                githubAccessToken: "ghp_test",
                isGuest: true,
                projectId: "",
            })
        ).toBe(false);
    });
});
