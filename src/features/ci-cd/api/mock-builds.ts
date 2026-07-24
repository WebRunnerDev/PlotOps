import type {
    BuildLogLine,
    BuildsForProject,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

/**
 * Deterministic mock builds for the CI/CD MVP.
 * Spec example: main passed, feature/analytics failed on tests.
 * Not Project-specific yet — same catalog for every projectId.
 */
const MOCK_BUILDS: ProjectBuild[] = [
    {
        branch: "main",
        commitMessage: "chore: bump board filters",
        commitSha: "a1b2c3d",
        finishedAt: "2026-07-24T09:12:04.000Z",
        id: "build-main-1",
        startedAt: "2026-07-24T09:10:01.000Z",
        status: "success",
    },
    {
        branch: "feature/analytics",
        commitMessage: "feat: analytics dashboard widgets",
        commitSha: "e4f5a6b",
        finishedAt: "2026-07-24T08:44:22.000Z",
        id: "build-analytics-1",
        startedAt: "2026-07-24T08:41:00.000Z",
        status: "failure",
        summary: "tests",
    },
    {
        branch: "feature/TASK-42-login-page",
        commitMessage: "feat: login form validation",
        commitSha: "c7d8e9f",
        id: "build-login-1",
        startedAt: "2026-07-24T10:02:11.000Z",
        status: "running",
    },
    {
        branch: "fix/CORE-7-invite-ttl",
        commitMessage: "fix: invite expiry edge cases",
        commitSha: "1a2b3c4",
        id: "build-invite-1",
        startedAt: "2026-07-24T10:05:00.000Z",
        status: "queued",
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
    async listBuilds(projectId: string): Promise<ProjectBuild[]> {
        void projectId;
        return MOCK_BUILDS.map((build) => ({ ...build }));
    },

    streamBuildLogs(projectId, buildId, onLine) {
        void projectId;
        const script = MOCK_LOG_SCRIPTS[buildId];
        if (!script || script.length === 0) {
            return () => {};
        }
        return streamMockLogLines(script, onLine);
    },
};
