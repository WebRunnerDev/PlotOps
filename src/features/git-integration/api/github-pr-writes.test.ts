import { afterEach, describe, expect, it, vi } from "vitest";

import {
    closePullRequest,
    createPullRequest,
    GitHubApiError,
    gitHubWriteErrorKind,
    mergePullRequest,
} from "@/features/git-integration/api/github-git-api";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("gitHubWriteErrorKind", () => {
    it("maps status codes used by Open/Merge", () => {
        expect(gitHubWriteErrorKind(new GitHubApiError(401, "/x"))).toBe(
            "auth"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(403, "/x"))).toBe(
            "forbidden"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(404, "/x"))).toBe(
            "not_found"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(405, "/x"))).toBe(
            "conflict"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(409, "/x"))).toBe(
            "conflict"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(422, "/x"))).toBe(
            "validation"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(429, "/x"))).toBe(
            "rate_limit"
        );
        expect(gitHubWriteErrorKind(new GitHubApiError(500, "/x"))).toBe(
            "unknown"
        );
        expect(gitHubWriteErrorKind(new Error("nope"))).toBe("unknown");
    });
});

describe("createPullRequest", () => {
    it("POSTs pulls with base/head/title", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({
                body: null,
                created_at: "2026-08-11T00:00:00Z",
                draft: false,
                head: { ref: "feature/TASK-1" },
                html_url: "https://github.com/o/r/pull/7",
                mergeable: true,
                merged_at: null,
                number: 7,
                state: "open",
                title: "TASK-1: Login",
                updated_at: "2026-08-11T00:00:00Z",
            }),
            ok: true,
            status: 201,
        });
        vi.stubGlobal("fetch", fetchMock);

        const pr = await createPullRequest({
            base: "main",
            head: "feature/TASK-1",
            repoFullName: "o/r",
            title: "TASK-1: Login",
            token: "tok",
        });

        expect(pr.number).toBe(7);
        expect(pr.mergeable).toBe(true);
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.github.com/repos/o/r/pulls");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({
            base: "main",
            draft: false,
            head: "feature/TASK-1",
            title: "TASK-1: Login",
        });
    });

    it("throws GitHubApiError on failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({ ok: false, status: 422 })
        );

        await expect(
            createPullRequest({
                base: "main",
                head: "feature/x",
                repoFullName: "o/r",
                title: "x",
                token: "tok",
            })
        ).rejects.toMatchObject({ status: 422 });
    });
});

describe("mergePullRequest", () => {
    it("PUTs merge with merge_method", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({
                merged: true,
                message: "Pull Request successfully merged",
                sha: "abc123",
            }),
            ok: true,
            status: 200,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await mergePullRequest({
            commitTitle: "TASK-1: Login",
            mergeMethod: "squash",
            prNumber: 7,
            repoFullName: "o/r",
            token: "tok",
        });

        expect(result.merged).toBe(true);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.github.com/repos/o/r/pulls/7/merge");
        expect(init.method).toBe("PUT");
        expect(JSON.parse(String(init.body))).toEqual({
            commit_title: "TASK-1: Login",
            merge_method: "squash",
        });
    });
});

describe("closePullRequest", () => {
    it("PATCHes pull with state closed", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({
                body: null,
                created_at: "2026-08-11T00:00:00Z",
                draft: false,
                head: { ref: "feature/TASK-1" },
                html_url: "https://github.com/o/r/pull/7",
                mergeable: false,
                merged_at: null,
                number: 7,
                state: "closed",
                title: "TASK-1: Login",
                updated_at: "2026-08-11T01:00:00Z",
            }),
            ok: true,
            status: 200,
        });
        vi.stubGlobal("fetch", fetchMock);

        const pr = await closePullRequest({
            prNumber: 7,
            repoFullName: "o/r",
            token: "tok",
        });

        expect(pr.number).toBe(7);
        expect(pr.state).toBe("closed");
        expect(pr.merged_at).toBeNull();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.github.com/repos/o/r/pulls/7");
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(String(init.body))).toEqual({ state: "closed" });
    });
});
