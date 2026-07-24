import type {
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

export const mockBuildsForProject: BuildsForProject = {
    async listBuilds(projectId: string): Promise<ProjectBuild[]> {
        void projectId;
        return MOCK_BUILDS.map((build) => ({ ...build }));
    },
};
