import { describe, expect, it } from "vitest";

import type { GitCommit } from "@/features/git-integration/api/github-git-api";

import { mergeCommitsBySha, mergeRepositoryCommits } from "./merge-commits";

function commit(sha: string, date: null | string, message = sha): GitCommit {
    return {
        author: { avatar_url: null, date, login: null, name: null },
        message,
        sha,
        url: `https://example.com/${sha}`,
    };
}

describe("mergeCommitsBySha", () => {
    it("dedupes by sha preserving first occurrence", () => {
        const first = commit("abc123", null, "first");
        const second = { ...first, message: "second" };

        expect(mergeCommitsBySha([first], [second])).toEqual([first]);
    });
});

describe("mergeRepositoryCommits", () => {
    const web = { fullName: "acme/web", id: "web" };
    const api = { fullName: "acme/api", id: "api" };

    it("tags each commit with its Repository, newest first, undated last", () => {
        const rows = mergeRepositoryCommits([
            {
                commits: [
                    commit("aaa1111", "2026-01-01T00:00:00Z"),
                    commit("bbb2222", null),
                ],
                repository: web,
            },
            {
                commits: [commit("ccc3333", "2026-02-01T00:00:00Z")],
                repository: api,
            },
        ]);

        expect(rows.map((row) => [row.commit.sha, row.repository.id])).toEqual([
            ["ccc3333", "api"],
            ["aaa1111", "web"],
            ["bbb2222", "web"],
        ]);
    });

    it("keeps the first Repository listing a SHA and flags the linked commit", () => {
        const shared = commit("ddd4444abcdef", "2026-01-01T00:00:00Z");
        const rows = mergeRepositoryCommits(
            [
                { commits: [shared], repository: web },
                { commits: [shared], repository: api },
            ],
            "ddd4444"
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.repository).toBe(web);
        expect(rows[0]?.linked).toBe(true);
    });
});
