import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPullRequestChecks } from "@/features/git-integration/api/github-git-api";

describe("fetchPullRequestChecks", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("resolves head sha then maps check runs and rollup", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    body: null,
                    created_at: "2026-07-28T10:00:00.000Z",
                    draft: false,
                    head: { ref: "feature/demo", sha: "abc123deadbeef" },
                    html_url: "https://github.com/org/repo/pull/42",
                    mergeable: true,
                    merged_at: null,
                    number: 42,
                    state: "open",
                    title: "Demo",
                    updated_at: "2026-07-28T11:00:00.000Z",
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    check_runs: [
                        {
                            completed_at: "2026-07-28T11:05:00.000Z",
                            conclusion: "success",
                            details_url:
                                "https://github.com/org/repo/actions/1",
                            html_url: "https://github.com/org/repo/runs/1",
                            id: 11,
                            name: "CI / test",
                            started_at: "2026-07-28T11:00:00.000Z",
                            status: "completed",
                        },
                        {
                            completed_at: null,
                            conclusion: null,
                            details_url:
                                "https://github.com/org/repo/actions/2",
                            html_url: "https://github.com/org/repo/runs/2",
                            id: 12,
                            name: "Bugbot",
                            started_at: "2026-07-28T11:01:00.000Z",
                            status: "in_progress",
                        },
                    ],
                    total_count: 2,
                })
            );

        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPullRequestChecks("org/repo", 42, "ghp_test");

        expect(result.sha).toBe("abc123deadbeef");
        expect(result.truncated).toBe(false);
        expect(result.rollup).toBe("pending");
        expect(result.checks).toEqual([
            {
                completedAt: "2026-07-28T11:05:00.000Z",
                conclusion: "success",
                detailsUrl: "https://github.com/org/repo/actions/1",
                htmlUrl: "https://github.com/org/repo/runs/1",
                id: 11,
                name: "CI / test",
                startedAt: "2026-07-28T11:00:00.000Z",
                status: "completed",
            },
            {
                completedAt: null,
                conclusion: null,
                detailsUrl: "https://github.com/org/repo/actions/2",
                htmlUrl: "https://github.com/org/repo/runs/2",
                id: 12,
                name: "Bugbot",
                startedAt: "2026-07-28T11:01:00.000Z",
                status: "in_progress",
            },
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "/repos/org/repo/pulls/42"
        );
        expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
            "/repos/org/repo/commits/abc123deadbeef/check-runs"
        );
    });

    it("marks truncated when max pages are exhausted", async () => {
        const page = {
            check_runs: Array.from({ length: 100 }, (_, index) => ({
                completed_at: "2026-07-28T11:05:00.000Z",
                conclusion: "success",
                details_url: null,
                html_url: `https://github.com/org/repo/runs/${index}`,
                id: index + 1,
                name: `check-${index}`,
                started_at: "2026-07-28T11:00:00.000Z",
                status: "completed",
            })),
            total_count: 600,
        };

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    body: null,
                    created_at: "2026-07-28T10:00:00.000Z",
                    draft: false,
                    head: { ref: "feature/demo", sha: "deadbeef" },
                    html_url: "https://github.com/org/repo/pull/7",
                    mergeable: true,
                    merged_at: null,
                    number: 7,
                    state: "open",
                    title: "Demo",
                    updated_at: "2026-07-28T11:00:00.000Z",
                })
            )
            .mockResolvedValue(jsonResponse(page));

        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPullRequestChecks("org/repo", 7, "ghp_test");

        expect(result.checks).toHaveLength(500);
        expect(result.truncated).toBe(true);
        expect(result.rollup).toBe("success");
        // 1 pull + 5 check-run pages
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });
});

function jsonResponse(body: unknown): Response {
    return {
        json: async () => body,
        ok: true,
        status: 200,
    } as Response;
}
