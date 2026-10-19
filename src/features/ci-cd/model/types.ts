/** One job inside a workflow run (Actions job or mock step). */
export type BuildJob = {
    id: string;
    name: string;
    status: BuildStatus;
};

/** One streamed log line from a build. */
export type BuildLogLine = {
    /** True on the final line of this stream. */
    done: boolean;
    index: number;
    text: string;
};

/**
 * Narrow “builds for this Project” seam.
 * Product: GitHub Actions. Tests: mock provider at the same shape.
 */
export type BuildsForProject = {
    /**
     * Repo-wide run totals — independent of how many pages the list loaded.
     * Drives the summary cells so the numbers do not grow while scrolling.
     */
    getBuildsStats(
        projectId: string,
        options?: GetBuildsStatsOptions
    ): Promise<BuildsStats>;
    /** Jobs for a run — used by the detail dialog checklist. */
    listBuildJobs(projectId: string, buildId: string): Promise<BuildJob[]>;
    listBuilds(
        projectId: string,
        options?: ListBuildsOptions
    ): Promise<ListBuildsPage>;
    /**
     * Progressive log lines for a build. Calls `onLine` as lines “stream” in.
     * Returns unsubscribe to stop the stream (e.g. on unmount / close).
     */
    streamBuildLogs(
        projectId: string,
        buildId: string,
        onLine: (line: BuildLogLine) => void
    ): () => void;
};

/**
 * Repo-wide workflow-run totals. Counts every run the provider knows about,
 * not only the pages currently loaded into the list.
 */
export type BuildsStats = {
    /** Latest run on the default branch, when the branch has ever run. */
    defaultBranchBuild?: ProjectBuild;
    /** Completed runs whose conclusion is not `success`. */
    failure: number;
    /** Runs that are queued or in progress. */
    running: number;
    /** Completed runs whose conclusion is `success`. */
    success: number;
    /** Every run, in any state. */
    total: number;
};

/** Outcome of a CI run for a branch — MVP statuses only. */
export type BuildStatus = "failure" | "queued" | "running" | "success";

export type GetBuildsStatsOptions = {
    /** Branch whose latest run is reported as `defaultBranchBuild`. */
    defaultBranch?: string;
};

export type ListBuildsOptions = {
    /** 1-based page index. Defaults to 1. */
    page?: number;
    /** Page size. Provider default applies when omitted. */
    perPage?: number;
};

/** One page of workflow runs from `listBuilds`. */
export type ListBuildsPage = {
    builds: ProjectBuild[];
    hasMore: boolean;
    page: number;
};

/**
 * One build / workflow run for a Project. Branch is the scannable key;
 * status drives success/failure accents on the CI/CD screen.
 */
export type ProjectBuild = {
    branch: string;
    commitMessage: string;
    commitSha: string;
    finishedAt?: string;
    htmlUrl: string;
    id: string;
    jobs?: BuildJob[];
    startedAt: string;
    status: BuildStatus;
    /** Short reason when status is failure (e.g. "tests"). */
    summary?: string;
    workflowName: string;
};
