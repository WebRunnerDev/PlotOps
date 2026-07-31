import { unzipSync } from "fflate";

import type {
    BuildJob,
    BuildLogLine,
    BuildsForProject,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
} from "@/features/auth/model/github-token";
import { mapActionsStatus } from "@/features/ci-cd/model/map-actions-status";
import { fetchProject } from "@/features/projects/api/projects-api";

const GITHUB_API = "https://api.github.com";
const RUNS_PER_PAGE = "30";
const STREAM_CHUNK_MS = 16;

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

export class CiCdProjectError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CiCdProjectError";
    }
}

export class CiCdUnauthorizedError extends Error {
    constructor() {
        super("GitHub access token is invalid or expired");
        this.name = "CiCdUnauthorizedError";
    }
}

/** Pure mapper — exported for unit tests. */
export function mapWorkflowRunToBuild(run: RawWorkflowRun): ProjectBuild {
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

/** Pure progressive emitter — exported for unit tests. */
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

    let index = 0;
    let stopped = false;
    const timer = setInterval(() => {
        if (stopped) {
            clearInterval(timer);
            return;
        }
        const text = lines[index];
        if (text === undefined) {
            clearInterval(timer);
            return;
        }
        const done = index === lines.length - 1;
        onLine({ done, index, text });
        index += 1;
        if (done) {
            clearInterval(timer);
        }
    }, STREAM_CHUNK_MS);

    return () => {
        stopped = true;
        clearInterval(timer);
    };
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

async function resolveRepoContext(projectId: string): Promise<{
    repoFullName: string;
    token: string;
}> {
    const token = getGitHubAccessToken();
    if (!token) {
        throw new CiCdMissingTokenError();
    }

    const { data: project, error } = await fetchProject(projectId);
    if (error || !project) {
        throw new CiCdProjectError(
            error?.message ?? "Project not found for CI/CD"
        );
    }

    if (!project.github_full_name) {
        throw new CiCdProjectError(
            "Project has no linked GitHub repository for CI/CD"
        );
    }

    return { repoFullName: project.github_full_name, token };
}

function throwIfUnauthorized(status: number): void {
    if (status !== 401) return;
    clearGitHubAccessToken();
    throw new CiCdUnauthorizedError();
}

export const githubActionsBuilds: BuildsForProject = {
    async listBuildJobs(
        projectId: string,
        buildId: string
    ): Promise<BuildJob[]> {
        const { repoFullName, token } = await resolveRepoContext(projectId);
        return fetchRunJobs(repoFullName, buildId, token);
    },

    async listBuilds(projectId: string): Promise<ProjectBuild[]> {
        const { repoFullName, token } = await resolveRepoContext(projectId);

        const raw = await githubJson<RawWorkflowRunsResponse>(
            `/repos/${repoFullName}/actions/runs`,
            token,
            { per_page: RUNS_PER_PAGE }
        );

        return raw.workflow_runs.map((run) => mapWorkflowRunToBuild(run));
    },

    streamBuildLogs(projectId, buildId, onLine) {
        let stopProgress: (() => void) | undefined;
        let cancelled = false;

        void (async () => {
            try {
                const { repoFullName, token } =
                    await resolveRepoContext(projectId);
                if (cancelled) return;

                const jobs = await fetchRunJobs(repoFullName, buildId, token);
                if (cancelled) return;

                const lines: string[] = [];

                if (jobs.length === 0) {
                    lines.push("No jobs found for this run.");
                }

                for (const job of jobs) {
                    lines.push(`── ${job.name} · ${job.status} ──`);
                    try {
                        const logText = await fetchJobLogText(
                            repoFullName,
                            job.id,
                            token
                        );
                        if (cancelled) return;
                        if (logText) {
                            lines.push(...splitLogLines(logText));
                        } else if (
                            job.status === "running" ||
                            job.status === "queued"
                        ) {
                            lines.push(
                                "Logs not ready yet — job still in progress."
                            );
                        } else {
                            lines.push(
                                "Logs unavailable (expired or not retained)."
                            );
                        }
                    } catch {
                        if (cancelled) return;
                        lines.push("Could not download logs for this job.");
                    }
                    lines.push("");
                }

                stopProgress = streamLinesProgressively(lines, onLine);
                if (cancelled) {
                    stopProgress();
                    return;
                }
            } catch (error) {
                if (cancelled) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : "Failed to load build logs";
                stopProgress = streamLinesProgressively([message], onLine);
                if (cancelled) {
                    stopProgress();
                }
            }
        })();

        return () => {
            cancelled = true;
            stopProgress?.();
        };
    },
};
