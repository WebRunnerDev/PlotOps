/**
 * Narrow “builds for this Project” seam.
 * MVP: mock provider. Later: GitHub Actions at the same shape.
 */
export type BuildsForProject = {
    listBuilds(projectId: string): Promise<ProjectBuild[]>;
};

/** Outcome of a CI run for a branch — MVP statuses only. */
export type BuildStatus = "failure" | "queued" | "running" | "success";

/**
 * One build row for a Project. Branch is the scannable key;
 * status drives success/failure accents on the CI/CD screen.
 */
export type ProjectBuild = {
    branch: string;
    commitMessage: string;
    commitSha: string;
    finishedAt?: string;
    id: string;
    startedAt: string;
    status: BuildStatus;
    /** Short reason when status is failure (e.g. "tests"). */
    summary?: string;
};
