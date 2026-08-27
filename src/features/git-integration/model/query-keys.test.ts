import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { clearGitQueryCache } from "./clear-git-query-cache";
import { gitKeys } from "./query-keys";

describe("git query keys auth fingerprint", () => {
    it("scopes commits, pullRequests, and prFiles by auth fingerprint", () => {
        const userA = "user_a";
        const userB = "user_b";

        expect(gitKeys.commits(userA, "org/repo", "main")).toEqual([
            "git",
            "commits",
            userA,
            "org/repo",
            "main",
        ]);
        expect(gitKeys.pullRequests(userA, "org/repo", "main")).toEqual([
            "git",
            "pull-requests",
            userA,
            "org/repo",
            "main",
        ]);
        expect(gitKeys.prFiles(userA, "org/repo", 42)).toEqual([
            "git",
            "pr-files",
            userA,
            "org/repo",
            42,
        ]);
        expect(gitKeys.prCommits(userA, "org/repo", 42)).toEqual([
            "git",
            "pr-commits",
            userA,
            "org/repo",
            42,
        ]);
        expect(gitKeys.prChecks(userA, "org/repo", 42)).toEqual([
            "git",
            "pr-checks",
            userA,
            "org/repo",
            42,
        ]);
        expect(gitKeys.commitFiles(userA, "org/repo", "abc")).toEqual([
            "git",
            "commit-files",
            userA,
            "org/repo",
            "abc",
        ]);

        expect(gitKeys.commits(userA, "org/repo", "main")).not.toEqual(
            gitKeys.commits(userB, "org/repo", "main")
        );
    });

    it("clearGitQueryCache removes all git queries", () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const key = gitKeys.commits("user_a", "org/repo", "main");
        queryClient.setQueryData(key, [{ sha: "abc" }]);

        clearGitQueryCache(queryClient);

        expect(queryClient.getQueryData(key)).toBeUndefined();
    });
});
