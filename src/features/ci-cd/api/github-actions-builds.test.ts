import { zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
    setGitHubAccessToken,
} from "@/features/auth/model/github-token";
import {
    CiCdUnauthorizedError,
    githubActionsBuilds,
    mapWorkflowRunToBuild,
    splitLogLines,
    streamLinesProgressively,
    unzipJobLogs,
} from "@/features/ci-cd/api/github-actions-builds";
import * as projectsApi from "@/features/projects/api/projects-api";

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        clear: () => {
            store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

function jsonResponse(body: unknown) {
    return {
        json: () => Promise.resolve(body),
        ok: true,
        status: 200,
    } as unknown as Response;
}

describe("mapWorkflowRunToBuild", () => {
    it("maps a completed successful run", () => {
        const build = mapWorkflowRunToBuild({
            conclusion: "success",
            created_at: "2026-07-24T09:10:01.000Z",
            display_title: "chore: bump board filters",
            head_branch: "main",
            head_sha: "a1b2c3d4e5f6",
            html_url: "https://github.com/org/repo/actions/runs/99",
            id: 99,
            name: "CI",
            path: ".github/workflows/ci.yml",
            status: "completed",
            updated_at: "2026-07-24T09:12:04.000Z",
        });

        expect(build).toMatchObject({
            branch: "main",
            commitMessage: "chore: bump board filters",
            commitSha: "a1b2c3d",
            htmlUrl: "https://github.com/org/repo/actions/runs/99",
            id: "99",
            status: "success",
            workflowName: "CI",
        });
        expect(build.finishedAt).toBe("2026-07-24T09:12:04.000Z");
    });

    it("maps an in-progress run without finishedAt", () => {
        const build = mapWorkflowRunToBuild({
            conclusion: undefined,
            created_at: "2026-07-24T10:00:00.000Z",
            display_title: "feat: login",
            head_branch: "feature/login",
            head_sha: "deadbeef",
            html_url: "https://github.com/org/repo/actions/runs/100",
            id: 100,
            name: "CI",
            path: ".github/workflows/ci.yml",
            status: "in_progress",
            updated_at: "2026-07-24T10:01:00.000Z",
        });

        expect(build.status).toBe("running");
        expect(build.finishedAt).toBeUndefined();
    });
});

describe("splitLogLines", () => {
    it("splits on newlines and drops a trailing empty line", () => {
        expect(splitLogLines("a\nb\n")).toEqual(["a", "b"]);
        expect(splitLogLines("a\r\nb")).toEqual(["a", "b"]);
        expect(splitLogLines("")).toEqual([]);
    });
});

describe("unzipJobLogs", () => {
    it("concatenates text entries from a zip", () => {
        const encoder = new TextEncoder();
        const zipped = zipSync({
            "0_test.txt": encoder.encode("line one\nline two\n"),
            "1_lint.txt": encoder.encode("lint ok\n"),
        });

        const text = unzipJobLogs(zipped);
        expect(text).toContain("line one");
        expect(text).toContain("lint ok");
    });
});

describe("streamLinesProgressively cancel after assign", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("stops immediately when unsubscribe runs right after start", () => {
        const lines: string[] = [];
        const stop = streamLinesProgressively(["a", "b", "c"], (line) => {
            lines.push(line.text);
        });

        // Race fix pattern: assign then cancel before first tick.
        stop();
        vi.advanceTimersByTime(500);
        expect(lines).toEqual([]);
    });
});

describe("GitHub Actions 401 clears token SoT", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", createMemoryStorage());
        clearGitHubAccessToken();
        setGitHubAccessToken("stale-token", "user-1");
    });

    afterEach(() => {
        clearGitHubAccessToken();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("listBuilds clears the SoT and throws CiCdUnauthorizedError on 401", async () => {
        vi.spyOn(projectsApi, "fetchProject").mockResolvedValue({
            count: null,
            data: {
                created_at: "2026-01-01T00:00:00.000Z",
                description: null,
                github_default_branch: "main",
                github_full_name: "org/repo",
                github_html_url: "https://github.com/org/repo",
                github_repo_id: 1,
                id: "project-1",
                is_private: false,
                name: "Repo",
                owner_id: "user-1",
                slug: "repo",
                team_id: "team-1",
                updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
            status: 200,
            statusText: "OK",
            success: true,
        });

        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            })
        );

        await expect(
            githubActionsBuilds.listBuilds("project-1")
        ).rejects.toBeInstanceOf(CiCdUnauthorizedError);

        expect(getGitHubAccessToken()).toBeNull();
    });
});

describe("getBuildsStats", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", createMemoryStorage());
        clearGitHubAccessToken();
        setGitHubAccessToken("token", "user-1");
        vi.spyOn(projectsApi, "fetchProject").mockResolvedValue({
            count: null,
            data: {
                created_at: "2026-01-01T00:00:00.000Z",
                description: null,
                github_default_branch: "main",
                github_full_name: "org/repo",
                github_html_url: "https://github.com/org/repo",
                github_repo_id: 1,
                id: "project-1",
                is_private: false,
                name: "Repo",
                owner_id: "user-1",
                slug: "repo",
                team_id: "team-1",
                updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
            status: 200,
            statusText: "OK",
            success: true,
        });
    });

    afterEach(() => {
        clearGitHubAccessToken();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("counts the whole repo, not the loaded page", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((input: string) => {
                const url = new URL(input);
                const status = url.searchParams.get("status");
                const branch = url.searchParams.get("branch");

                if (branch === "main") {
                    return Promise.resolve(
                        jsonResponse({
                            total_count: 120,
                            workflow_runs: [
                                {
                                    conclusion: "success",
                                    created_at: "2026-07-24T09:10:01.000Z",
                                    display_title: "chore: bump filters",
                                    head_branch: "main",
                                    head_sha: "a1b2c3d4",
                                    html_url:
                                        "https://github.com/org/repo/actions/runs/99",
                                    id: 99,
                                    name: "CI",
                                    path: ".github/workflows/ci.yml",
                                    status: "completed",
                                    updated_at: "2026-07-24T09:12:04.000Z",
                                },
                            ],
                        })
                    );
                }

                const totals: Record<string, number> = {
                    all: 340,
                    completed: 336,
                    success: 300,
                };
                return Promise.resolve(
                    jsonResponse({
                        total_count: totals[status ?? "all"] ?? 0,
                        workflow_runs: [],
                    })
                );
            })
        );

        const stats = await githubActionsBuilds.getBuildsStats("project-1", {
            defaultBranch: "main",
        });

        expect(stats).toMatchObject({
            failure: 36,
            running: 4,
            success: 300,
            total: 340,
        });
        expect(stats.defaultBranchBuild).toMatchObject({
            branch: "main",
            id: "99",
            status: "success",
        });
    });

    it("skips the branch lookup when no default branch is known", async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(jsonResponse({ total_count: 0, workflow_runs: [] }))
        );
        vi.stubGlobal("fetch", fetchMock);

        const stats = await githubActionsBuilds.getBuildsStats("project-1");

        expect(stats.defaultBranchBuild).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
