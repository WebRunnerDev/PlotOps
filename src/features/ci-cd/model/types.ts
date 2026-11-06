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
 * Narrow “builds for one Repository” seam (ADR 0035: a Project has several).
 * Product: GitHub Actions. Tests: mock provider at the same shape.
 * The Project-wide feed is assembled from these calls in `project-feed.ts`.
 */
export type BuildsForProject = {
    /**
     * Repo-wide run totals — independent of how many pages the list loaded.
     * Drives the summary cells so the numbers do not grow while scrolling.
     */
    getBuildsStats(
        repository: BuildsRepository,
        options?: GetBuildsStatsOptions
    ): Promise<BuildsStats>;
    /** Jobs for a run — used by the detail dialog checklist. */
    listBuildJobs(
        repository: BuildsRepository,
        buildId: string
    ): Promise<BuildJob[]>;
    listBuilds(
        repository: BuildsRepository,
        options?: ListBuildsOptions
    ): Promise<ListBuildsPage>;
    /**
     * Progressive log lines for a build. Calls `onLine` as lines “stream” in.
     * Returns unsubscribe to stop the stream (e.g. on unmount / close).
     */
    streamBuildLogs(
        repository: BuildsRepository,
        buildId: string,
        onLine: (line: BuildLogLine) => void
    ): () => void;
};

/** A Repository of the Project whose GitHub Actions runs the feed shows. */
export type BuildsRepository = {
    /** GitHub default branch — the branch the summary reports on. */
    defaultBranch: string;
    /** `owner/name` on GitHub. */
    fullName: string;
    /** `project_repositories.id`. */
    id: string;
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
    /** `project_repositories.id` of the Repository the run belongs to. */
    repositoryId: string;
    /** `owner/name` of that Repository — the Repo column. */
    repositoryName: string;
    startedAt: string;
    status: BuildStatus;
    /** Short reason when status is failure (e.g. "tests"). */
    summary?: string;
    workflowName: string;
};
