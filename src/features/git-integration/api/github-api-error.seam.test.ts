import { describe, expect, it } from "vitest";

import {
    GitHubApiError,
    isGitHubApiError,
} from "@/features/git-integration/api/github-git-api";

describe("GitHubApiError", () => {
    it("exposes HTTP status for callers to map messaging", () => {
        const error = new GitHubApiError(404, "/repos/o/r/pulls/1");
        expect(isGitHubApiError(error)).toBe(true);
        expect(error.status).toBe(404);
        expect(error.message).toContain("404");
    });

    it("is distinguishable from generic Error", () => {
        expect(isGitHubApiError(new Error("GitHub API 404: /x"))).toBe(false);
    });
});
