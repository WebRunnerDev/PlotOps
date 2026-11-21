import { unzipSync } from "fflate";

import type {
    BuildJob,
    BuildLogLine,
    BuildsForProject,
    BuildsRepository,
    BuildsStats,
    GetBuildsStatsOptions,
    ListBuildsOptions,
    ListBuildsPage,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
} from "@/features/auth/model/github-token";
import {
    BUILDS_PAGE_SIZE,
    hasMoreBuilds,
} from "@/features/ci-cd/model/builds-page";
import { deriveBuildsStats } from "@/features/ci-cd/model/builds-stats";
import { mapActionsStatus } from "@/features/ci-cd/model/map-actions-status";

const GITHUB_API = "https://api.github.com";
const STREAM_CHUNK_MS = 16;
const STREAM_MAX_TICKS = 60;

const GITHUB_HEADERS = (token: string) => ({
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
});

type RawJob = {
    conclusion: null | string;
    id: number;
    name: string;
    status: string;
};

type RawJobsResponse = {
    jobs: RawJob[];
    total_count: number;
};

type RawWorkflowRun = {
    conclusion: null | string | undefined;
    created_at: string;
    display_title: string;
    head_branch: string;
    head_sha: string;
    html_url: string;
    id: number;
    name: null | string;
    path: string;
    status: string;
    updated_at: string;
};

type RawWorkflowRunsResponse = {
    total_count: number;
    workflow_runs: RawWorkflowRun[];
};

export class CiCdMissingTokenError extends Error {
    constructor() {
        super("GitHub access token is missing");
        this.name = "CiCdMissingTokenError";
    }
}

export class CiCdUnauthorizedError extends Error {
    constructor() {
        super("GitHub access token is invalid or expired");
        this.name = "CiCdUnauthorizedError";
    }
}

/**
 * Hand the whole log over in one batch — a finished job's log is final, so
 * there is nothing to "stream". The last line carries `done`.
 */
export function emitLinesAtOnce(
    lines: string[],
    onLine: (line: BuildLogLine) => void
): void {
    if (lines.length === 0) {
        onLine({ done: true, index: 0, text: "" });
        return;
    }
    for (const [index, text] of lines.entries()) {
        onLine({ done: index === lines.length - 1, index, text });
    }
}

/** Pure mapper — exported for unit tests. */
export function mapWorkflowRunToBuild(
    run: RawWorkflowRun,
    repository: Pick<BuildsRepository, "fullName" | "id">
): ProjectBuild {
    const commitMessage =
        run.display_title?.trim() ||
        run.name?.trim() ||
        run.path
            .split("/")
            .at(-1)
            ?.replace(/\.ya?ml$/i, "") ||
        "Workflow run";

    return {
        branch: run.head_branch || "—",
        commitMessage,
        commitSha: run.head_sha.slice(0, 7),
        finishedAt: run.status === "completed" ? run.updated_at : undefined,
        htmlUrl: run.html_url,
        id: String(run.id),
        repositoryId: repository.id,
        repositoryName: repository.fullName,
        startedAt: run.created_at,
        status: mapActionsStatus(run.status, run.conclusion),
        workflowName: run.name?.trim() || "Workflow",
    };
}

/** Split log text into lines; empty trailing newline does not add a blank. */
export function splitLogLines(text: string): string[] {
    if (!text) return [];
    return text.replaceAll("\r\n", "\n").replace(/\n$/, "").split("\n");
}

/**
 * Pure progressive emitter — exported for unit tests. Emits a batch of lines
 * per tick so a log of any length finishes in about `STREAM_MAX_TICKS` ticks
 * (a real job log runs to thousands of lines).
 */
export function streamLinesProgressively(
    lines: string[],
    onLine: (line: BuildLogLine) => void
): () => void {
    if (lines.length === 0) {
        const timer = setTimeout(() => {
            onLine({ done: true, index: 0, text: "" });
        }, 0);
        return () => {
            clearTimeout(timer);
        };
    }

    const perTick = Math.max(1, Math.ceil(lines.length / STREAM_MAX_TICKS));
    let index = 0;
    let stopped = false;
    const timer = setInterval(() => {
        const end = Math.min(index + perTick, lines.length);
        while (!stopped && index < end) {
            const done = index === lines.length - 1;
            onLine({ done, index, text: lines[index] ?? "" });
            index += 1;
        }
        if (stopped || index >= lines.length) {
            clearInterval(timer);
        }
    }, STREAM_CHUNK_MS);

    return () => {
        stopped = true;
        clearInterval(timer);
    };
}

/** Drop the ISO timestamp GitHub prefixes to every Actions log line. */
export function stripLogTimestamp(line: string): string {
    return line.replace(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/,
        ""
    );
}

/** Extract concatenated text files from a GitHub Actions job-logs zip. */
export function unzipJobLogs(bytes: Uint8Array): string {
    const entries = unzipSync(bytes);
    const parts: string[] = [];
    const names = Object.keys(entries).toSorted();
    for (const name of names) {
        const data = entries[name];
        if (!data) continue;
        // Skip directories (empty) and non-text names
        if (name.endsWith("/")) continue;
        parts.push(new TextDecoder().decode(data));
    }
    return parts.join("\n");
}

async function fetchJobLogText(
    repoFullName: string,
    jobId: string,
    token: string
): Promise<string | undefined> {
    const response = await fetch(
        `${GITHUB_API}/repos/${repoFullName}/actions/jobs/${jobId}/logs`,
        {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": "2022-11-28",
            },
            redirect: "follow",
        }
    );

    // 404 — logs expired or not ready yet
    if (response.status === 404) {
        return undefined;
    }

    throwIfUnauthorized(response.status);

    if (!response.ok) {
        throw new Error(`GitHub API ${response.status}: job logs ${jobId}`);
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length === 0) return undefined;

    // ZIP magic PK
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        return unzipJobLogs(buffer);
    }

    return new TextDecoder().decode(buffer);
}

async function fetchLatestBranchRun(
    repository: BuildsRepository,
    token: string,
    branch: string
): Promise<ProjectBuild | undefined> {
    const raw = await githubJson<RawWorkflowRunsResponse>(
        `/repos/${repository.fullName}/actions/runs`,
        token,
        { branch, per_page: "1" }
    );
    const run = raw.workflow_runs[0];
    return run ? mapWorkflowRunToBuild(run, repository) : undefined;
}

/** `total_count` for one run bucket — `per_page=1` keeps the payload tiny. */
async function fetchRunCount(
    repoFullName: string,
    token: string,
    status?: string
): Promise<number> {
    const raw = await githubJson<RawWorkflowRunsResponse>(
        `/repos/${repoFullName}/actions/runs`,
        token,
        status ? { per_page: "1", status } : { per_page: "1" }
    );
    return raw.total_count;
}

async function fetchRunJobs(
    repoFullName: string,
    runId: string,
    token: string
): Promise<BuildJob[]> {
    const raw = await githubJson<RawJobsResponse>(
        `/repos/${repoFullName}/actions/runs/${runId}/jobs`,
        token,
        { per_page: "100" }
    );
    return raw.jobs.map((job) => mapJob(job));
}

async function githubJson<T>(
    path: string,
    token: string,
    parameters?: Record<string, string>
): Promise<T> {
    const url = new URL(`${GITHUB_API}${path}`);
    if (parameters) {
        for (const [key, value] of Object.entries(parameters)) {
            url.searchParams.set(key, value);
        }
    }

    const response = await fetch(url.toString(), {
        headers: GITHUB_HEADERS(token),
    });

    throwIfUnauthorized(response.status);

    if (!response.ok) {
        throw new Error(`GitHub API ${response.status}: ${path}`);
    }

    return response.json() as Promise<T>;
}

function mapJob(job: RawJob): BuildJob {
    return {
        id: String(job.id),
        name: job.name,
        status: mapActionsStatus(job.status, job.conclusion),
    };
}

function requireToken(): string {
    const token = getGitHubAccessToken();
    if (!token) {
        throw new CiCdMissingTokenError();
    }
    return token;
}

function throwIfUnauthorized(status: number): void {
    if (status !== 401) return;
    clearGitHubAccessToken();
    throw new CiCdUnauthorizedError();
}

export const githubActionsBuilds: BuildsForProject = {
    async getBuildsStats(
        repository: BuildsRepository,
        options?: GetBuildsStatsOptions
    ): Promise<BuildsStats> {
        const token = requireToken();
        const repoFullName = repository.fullName;
        const defaultBranch = options?.defaultBranch;

        const [total, completed, success, defaultBranchBuild] =
            await Promise.all([
                fetchRunCount(repoFullName, token),
                fetchRunCount(repoFullName, token, "completed"),
                fetchRunCount(repoFullName, token, "success"),
                defaultBranch
                    ? fetchLatestBranchRun(repository, token, defaultBranch)
                    : undefined,
            ]);

        return {
            ...deriveBuildsStats({ completed, success, total }),
            defaultBranchBuild,
        };
    },

    async listBuildJobs(
        repository: BuildsRepository,
        buildId: string
    ): Promise<BuildJob[]> {
        return fetchRunJobs(repository.fullName, buildId, requireToken());
    },

    async listBuilds(
        repository: BuildsRepository,
        options?: ListBuildsOptions
    ): Promise<ListBuildsPage> {
        const token = requireToken();
        const page = Math.max(1, options?.page ?? 1);
        const perPage = Math.max(1, options?.perPage ?? BUILDS_PAGE_SIZE);

        const raw = await githubJson<RawWorkflowRunsResponse>(
            `/repos/${repository.fullName}/actions/runs`,
            token,
            {
                page: String(page),
                per_page: String(perPage),
            }
        );

        return {
            builds: raw.workflow_runs.map((run) =>
                mapWorkflowRunToBuild(run, repository)
            ),
            hasMore: hasMoreBuilds({
                page,
                perPage,
                totalCount: raw.total_count,
            }),
            page,
        };
    },

    streamJobLogs(repository, job, onLine) {
        let stopProgress: (() => void) | undefined;
        let cancelled = false;

        void (async () => {
            let lines: string[];
            try {
                const logText = await fetchJobLogText(
                    repository.fullName,
                    job.id,
                    requireToken()
                );
                if (cancelled) return;
                if (logText) {
                    lines = splitLogLines(logText).map((line) =>
                        stripLogTimestamp(line)
                    );
                } else if (
                    job.status === "running" ||
                    job.status === "queued"
                ) {
                    lines = ["Logs not ready yet — job still in progress."];
                } else {
                    lines = ["Logs unavailable (expired or not retained)."];
                }
            } catch (error) {
                if (cancelled) return;
                lines = [
                    error instanceof Error
                        ? error.message
                        : "Could not download logs for this job.",
                ];
            }
            if (job.status === "running" || job.status === "queued") {
                stopProgress = streamLinesProgressively(lines, onLine);
            } else {
                emitLinesAtOnce(lines, onLine);
            }
        })();

        return () => {
            cancelled = true;
            stopProgress?.();
        };
    },
};
