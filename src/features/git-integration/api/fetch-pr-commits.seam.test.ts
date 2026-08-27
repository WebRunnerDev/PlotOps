import { afterEach, describe, expect, it, vi } from "vitest";

import {
    fetchCommitFiles,
    fetchPullRequestCommits,
} from "@/features/git-integration/api/github-git-api";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("fetchPullRequestCommits", () => {
    it("maps PR commits from GitHub list response", async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => [
                {
                    author: {
                        avatar_url: "https://avatars.example/u",
                        login: "alice",
                    },
                    commit: {
                        author: {
                            date: "2026-08-01T12:00:00Z",
                            name: "Alice",
                        },
                        message: "feat: login form\n\nDetails",
                    },
                    html_url: "https://github.com/o/r/commit/aaa111",
                    sha: "aaa111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                },
            ],
            ok: true,
        }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPullRequestCommits("o/r", 7, "token");

        expect(result).toEqual({
            commits: [
                {
                    author: {
                        avatar_url: "https://avatars.example/u",
                        date: "2026-08-01T12:00:00Z",
                        login: "alice",
                        name: "Alice",
                    },
                    message: "feat: login form",
                    sha: "aaa111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    url: "https://github.com/o/r/commit/aaa111",
                },
            ],
            truncated: false,
        });
        const firstCall = fetchMock.mock.calls.at(0)?.at(0);
        expect(String(firstCall)).toContain("/repos/o/r/pulls/7/commits");
    });
});

describe("fetchCommitFiles", () => {
    it("maps changed files from a single commit", async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => ({
                files: [
                    {
                        additions: 4,
                        blob_url: "https://github.com/o/r/blob/sha/a.ts",
                        deletions: 1,
                        filename: "src/a.ts",
                        patch: "@@ -1 +1,4 @@\n+console.log(1)",
                        status: "modified",
                    },
                ],
            }),
            ok: true,
        }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchCommitFiles(
            "o/r",
            "aaa111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "token"
        );

        expect(result).toEqual({
            files: [
                {
                    additions: 4,
                    blob_url: "https://github.com/o/r/blob/sha/a.ts",
                    deletions: 1,
                    filename: "src/a.ts",
                    patch: "@@ -1 +1,4 @@\n+console.log(1)",
                    previous_filename: undefined,
                    status: "modified",
                },
            ],
            truncated: false,
        });
        const firstCall = fetchMock.mock.calls.at(0)?.at(0);
        expect(String(firstCall)).toContain(
            "/repos/o/r/commits/aaa111bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        );
    });
});
