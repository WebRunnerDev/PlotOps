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
    stripLogTimestamp,
    unzipJobLogs,
} from "@/features/ci-cd/api/github-actions-builds";

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

const REPOSITORY = {
    defaultBranch: "main",
    fullName: "org/repo",
    id: "repo-1",
};

async function collect(
    job: Parameters<typeof githubActionsBuilds.streamJobLogs>[1]
) {
    const lines: string[] = [];
    const stop = githubActionsBuilds.streamJobLogs(REPOSITORY, job, (line) => {
        if (line.text.length > 0) lines.push(line.text);
    });
    await vi.advanceTimersByTimeAsync(2000);
    stop();
    return lines;
}

function jsonResponse(body: unknown) {
    return {
        json: () => Promise.resolve(body),
        ok: true,
        status: 200,
    } as unknown as Response;
}

function receiveDone(status: "running" | "success") {
    const received: { done: boolean }[] = [];
    const stop = githubActionsBuilds.streamJobLogs(
        REPOSITORY,
        { id: "7", name: "build", status },
        (line) => {
            received.push({ done: line.done });
        }
    );
    return { received, stop };
}

function textResponse(text: string, status = 200) {
    return {
        arrayBuffer: () =>
            Promise.resolve(new TextEncoder().encode(text).buffer),
        ok: status < 400,
        status,
    } as unknown as Response;
}

describe("mapWorkflowRunToBuild", () => {
    it("maps a completed successful run", () => {
        const build = mapWorkflowRunToBuild(
            {
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
            },
            REPOSITORY
        );

        expect(build).toMatchObject({
            branch: "main",
            commitMessage: "chore: bump board filters",
            commitSha: "a1b2c3d",
            htmlUrl: "https://github.com/org/repo/actions/runs/99",
            id: "99",
            repositoryId: "repo-1",
            repositoryName: "org/repo",
            status: "success",
            workflowName: "CI",
        });
        expect(build.finishedAt).toBe("2026-07-24T09:12:04.000Z");
    });

    it("maps an in-progress run without finishedAt", () => {
        const build = mapWorkflowRunToBuild(
            {
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
            },
            REPOSITORY
        );

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

describe("streamLinesProgressively batching", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("finishes a long log in about a second, in order, with one done line", () => {
        const source = Array.from({ length: 6000 }, (_, index) => `l${index}`);
        const received: { done: boolean; index: number }[] = [];
        const stop = streamLinesProgressively(source, (line) => {
            received.push({ done: line.done, index: line.index });
        });

        vi.advanceTimersByTime(16);
        expect(received.length).toBe(100);

        vi.advanceTimersByTime(1000);
        expect(received.map((line) => line.index)).toEqual(
            source.map((_, index) => index)
        );
        expect(received.filter((line) => line.done)).toEqual([
            { done: true, index: 5999 },
        ]);
        stop();
    });
});

describe("stripLogTimestamp", () => {
    it("drops the Actions timestamp prefix and keeps other lines as they are", () => {
        expect(
            stripLogTimestamp(
                "2026-11-20T10:00:00.1234567Z ##[group]Run npm ci"
            )
        ).toBe("##[group]Run npm ci");
        expect(stripLogTimestamp("2026-11-20T10:00:00Z")).toBe("");
        expect(stripLogTimestamp("plain line")).toBe("plain line");
    });
});

describe("streamJobLogs", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("localStorage", createMemoryStorage());
        clearGitHubAccessToken();
        setGitHubAccessToken("token", "user-1");
    });

    afterEach(() => {
        clearGitHubAccessToken();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("downloads only the chosen job's log, without timestamps", async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(
                textResponse(
                    "2026-11-20T10:00:00.0000000Z $ npm test\n2026-11-20T10:00:01.0000000Z ok\n"
                )
            )
        );
        vi.stubGlobal("fetch", fetchMock);

        const lines = await collect({
            id: "42",
            name: "vitest (2/4)",
            status: "success",
        });

        expect(lines).toEqual(["$ npm test", "ok"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
            "https://api.github.com/repos/org/repo/actions/jobs/42/logs"
        );
    });

    it("hands a finished job's log over whole, and streams a running one", async () => {
        const text = Array.from({ length: 600 }, (_, index) => `l${index}`)
            .join("\n")
            .concat("\n");
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(textResponse(text)))
        );

        const finished = receiveDone("success");
        const running = receiveDone("running");
        await vi.advanceTimersByTimeAsync(0);

        expect(finished.received).toHaveLength(600);
        expect(finished.received.filter((line) => line.done)).toHaveLength(1);
        expect(finished.received.at(-1)?.done).toBe(true);
        expect(running.received.length).toBeLessThan(600);

        finished.stop();
        running.stop();
    });

    it("says the log is not ready while the job runs, and gone once it is done", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve(textResponse("", 404)))
        );

        expect(
            await collect({ id: "1", name: "e2e", status: "running" })
        ).toEqual(["Logs not ready yet — job still in progress."]);
        expect(
            await collect({ id: "1", name: "e2e", status: "failure" })
        ).toEqual(["Logs unavailable (expired or not retained)."]);
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
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            })
        );

        await expect(
            githubActionsBuilds.listBuilds(REPOSITORY)
        ).rejects.toBeInstanceOf(CiCdUnauthorizedError);

        expect(getGitHubAccessToken()).toBeNull();
    });
});

describe("getBuildsStats", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", createMemoryStorage());
        clearGitHubAccessToken();
        setGitHubAccessToken("token", "user-1");
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

        const stats = await githubActionsBuilds.getBuildsStats(REPOSITORY, {
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

        const stats = await githubActionsBuilds.getBuildsStats(REPOSITORY);

        expect(stats.defaultBranchBuild).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
