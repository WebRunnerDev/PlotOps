import type {
    BuildLogLine,
    BuildsForProject,
    ListBuildsOptions,
    ListBuildsPage,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import {
    BUILDS_PAGE_SIZE,
    hasMoreBuilds,
} from "@/features/ci-cd/model/builds-page";

/**
 * Deterministic mock builds for unit tests and Guest Mode.
 * Spec example: main passed, feature/analytics failed on tests.
 * Selected via `resolveBuildsProvider(true)` when the session is guest.
 */
const MOCK_BUILDS: ProjectBuild[] = [
    {
        branch: "main",
        commitMessage: "chore: bump board filters",
        commitSha: "a1b2c3d",
        finishedAt: "2026-07-24T09:12:04.000Z",
        htmlUrl: "https://github.com/example/plotops/actions/runs/1",
        id: "build-main-1",
        jobs: [
            { id: "job-1", name: "test", status: "success" },
            { id: "job-2", name: "lint", status: "success" },
        ],
        startedAt: "2026-07-24T09:10:01.000Z",
        status: "success",
        workflowName: "CI",
    },
    {
        branch: "feature/analytics",
        commitMessage: "feat: analytics dashboard widgets",
        commitSha: "e4f5a6b",
        finishedAt: "2026-07-24T08:44:22.000Z",
        htmlUrl: "https://github.com/example/plotops/actions/runs/2",
        id: "build-analytics-1",
        jobs: [
            { id: "job-3", name: "test", status: "failure" },
            { id: "job-4", name: "lint", status: "success" },
        ],
        startedAt: "2026-07-24T08:41:00.000Z",
        status: "failure",
        summary: "tests",
        workflowName: "CI",
    },
    {
        branch: "feature/TASK-42-login-page",
        commitMessage: "feat: login form validation",
        commitSha: "c7d8e9f",
        htmlUrl: "https://github.com/example/plotops/actions/runs/3",
        id: "build-login-1",
        jobs: [{ id: "job-5", name: "test", status: "running" }],
        startedAt: "2026-07-24T10:02:11.000Z",
        status: "running",
        workflowName: "CI",
    },
    {
        branch: "fix/CORE-7-invite-ttl",
        commitMessage: "fix: invite expiry edge cases",
        commitSha: "1a2b3c4",
        htmlUrl: "https://github.com/example/plotops/actions/runs/4",
        id: "build-invite-1",
        jobs: [{ id: "job-6", name: "test", status: "queued" }],
        startedAt: "2026-07-24T10:05:00.000Z",
        status: "queued",
        workflowName: "CI",
    },
];

/** Full log scripts keyed by build id — streamed via setInterval. */
const MOCK_LOG_SCRIPTS: Record<string, string[]> = {
    "build-analytics-1": [
        "$ git checkout feature/analytics",
        "$ npm ci",
        "added 412 packages in 18s",
        "$ npm run test",
        " FAIL  src/widgets/analytics/chart.test.ts",
        "Expected series length 7, received 0",
        "error Command failed with exit code 1.",
    ],
    "build-invite-1": [
        "Queued — waiting for a runner…",
        "No runner available yet.",
    ],
    "build-login-1": [
        "$ git checkout feature/TASK-42-login-page",
        "$ npm ci",
        "added 412 packages in 18s",
        "$ npm run lint",
        "… still running",
    ],
    "build-main-1": [
        "$ git checkout main",
        "$ npm ci",
        "added 412 packages in 18s",
        "$ npm run test",
        " PASS  src/features/tasks",
        " PASS  src/widgets/kanban-board",
        "All tests passed.",
        "✓ Build succeeded",
    ],
};

const STREAM_INTERVAL_MS = 50;

function streamMockLogLines(
    script: string[],
    onLine: (line: BuildLogLine) => void
): () => void {
    let index = 0;
    const timer = setInterval(() => {
        if (index >= script.length) {
            clearInterval(timer);
            return;
        }
        const text = script[index];
        if (text === undefined) {
            clearInterval(timer);
            return;
        }
        const done = index === script.length - 1;
        onLine({ done, index, text });
        index += 1;
        if (done) {
            clearInterval(timer);
        }
    }, STREAM_INTERVAL_MS);

    return () => {
        clearInterval(timer);
    };
}

export const mockBuildsForProject: BuildsForProject = {
    async listBuildJobs(projectId, buildId) {
        void projectId;
        const build = MOCK_BUILDS.find((item) => item.id === buildId);
        return build?.jobs?.map((job) => ({ ...job })) ?? [];
    },

    async listBuilds(
        projectId: string,
        options?: ListBuildsOptions
    ): Promise<ListBuildsPage> {
        void projectId;
        const page = Math.max(1, options?.page ?? 1);
        const perPage = Math.max(1, options?.perPage ?? BUILDS_PAGE_SIZE);
        const start = (page - 1) * perPage;
        const builds = MOCK_BUILDS.slice(start, start + perPage).map(
            (build) => ({ ...build })
        );

        return {
            builds,
            hasMore: hasMoreBuilds({
                page,
                perPage,
                totalCount: MOCK_BUILDS.length,
            }),
            page,
        };
    },

    streamBuildLogs(projectId, buildId, onLine) {
        void projectId;
        const script = MOCK_LOG_SCRIPTS[buildId];
        if (!script || script.length === 0) {
            // Complete immediately with no lines so UI does not stay “Streaming…”.
            const timer = setTimeout(() => {
                onLine({ done: true, index: 0, text: "" });
            }, 0);
            return () => {
                clearTimeout(timer);
            };
        }
        return streamMockLogLines(script, onLine);
    },
};
