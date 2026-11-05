import type {
    BuildsForProject,
    BuildsRepository,
    BuildsStats,
    BuildStatus,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { BUILDS_PAGE_SIZE } from "@/features/ci-cd/model/builds-page";

/** “All Repositories” value of the Repo filter. */
export const ALL_REPOSITORIES = "all";

/**
 * One page of the Project feed: page N of every Repository that still had
 * runs left after page N − 1 (ADR 0035, CI/CD shows one feed).
 */
export type FeedPageParameter = {
    page: number;
    repositoryIds: readonly string[];
};

/** Run totals for the whole Project and for each Repository. */
export type ProjectBuildsStats = {
    byRepository: Record<string, BuildsStats>;
    failedRepositoryIds: string[];
    total: BuildsStats;
};

export type ProjectFeedPage = {
    builds: ProjectBuild[];
    /** Repositories whose request failed on this page. */
    failedRepositoryIds: string[];
    /** Repositories that have another page after this one. */
    moreRepositoryIds: string[];
    page: number;
};

/** `ALL_REPOSITORIES` or a `project_repositories.id`. */
export type RepositoryFilter = string;

/** Feed-wide unique key: run ids repeat across Repositories in the mock. */
export function buildKey(build: ProjectBuild): string {
    return `${build.repositoryId}:${build.id}`;
}

export function filterBuildsByRepository(
    builds: readonly ProjectBuild[],
    filter: RepositoryFilter
): ProjectBuild[] {
    if (filter === ALL_REPOSITORIES) return [...builds];
    return builds.filter((build) => build.repositoryId === filter);
}

export function firstFeedPageParameter(
    repositories: readonly BuildsRepository[]
): FeedPageParameter {
    return {
        page: 1,
        repositoryIds: repositories.map((repository) => repository.id),
    };
}

/**
 * Totals across Repositories. A failed Repository is left out of the sums
 * and reported in `failedRepositoryIds`; only a token error, or every
 * Repository failing, rejects.
 */
export async function getProjectBuildsStats(
    provider: BuildsForProject,
    repositories: readonly BuildsRepository[]
): Promise<ProjectBuildsStats> {
    const results = await Promise.allSettled(
        repositories.map((repository) =>
            provider.getBuildsStats(repository, {
                defaultBranch: repository.defaultBranch,
            })
        )
    );
    throwIfFatal(results, true);

    const byRepository: Record<string, BuildsStats> = {};
    const failedRepositoryIds: string[] = [];
    for (const [index, result] of results.entries()) {
        const repository = repositories[index];
        if (!repository) continue;
        if (result.status === "fulfilled") {
            byRepository[repository.id] = result.value;
        } else {
            failedRepositoryIds.push(repository.id);
        }
    }

    return {
        byRepository,
        failedRepositoryIds,
        total: sumBuildsStats(Object.values(byRepository)),
    };
}

/** Whether the run is on its own Repository's default branch. */
export function isOnDefaultBranch(
    build: ProjectBuild,
    repositoriesById: ReadonlyMap<string, BuildsRepository>
): boolean {
    return (
        repositoriesById.get(build.repositoryId)?.defaultBranch === build.branch
    );
}

/**
 * Fetch one feed page from every Repository in `parameter` at once.
 * A Repository that fails (403, 404, network) is reported, not fatal, so the
 * other Repositories still show. Token errors and a first page on which
 * every Repository failed reject, which drives the page-level alerts.
 */
export async function listProjectFeedPage(
    provider: BuildsForProject,
    repositories: readonly BuildsRepository[],
    parameter: FeedPageParameter,
    perPage: number = BUILDS_PAGE_SIZE
): Promise<ProjectFeedPage> {
    const requested = repositories.filter((repository) =>
        parameter.repositoryIds.includes(repository.id)
    );
    const results = await Promise.allSettled(
        requested.map((repository) =>
            provider.listBuilds(repository, { page: parameter.page, perPage })
        )
    );
    throwIfFatal(results, parameter.page === 1);

    const builds: ProjectBuild[] = [];
    const failedRepositoryIds: string[] = [];
    const moreRepositoryIds: string[] = [];
    for (const [index, result] of results.entries()) {
        const repository = requested[index];
        if (!repository) continue;
        if (result.status === "rejected") {
            failedRepositoryIds.push(repository.id);
            continue;
        }
        builds.push(...result.value.builds);
        if (result.value.hasMore) moreRepositoryIds.push(repository.id);
    }

    return {
        builds: sortBuildsNewestFirst(builds),
        failedRepositoryIds,
        moreRepositoryIds,
        page: parameter.page,
    };
}

/** Loaded pages as one feed: newest first, deduplicated across refetches. */
export function mergeFeedPages(pages: readonly ProjectFeedPage[]): {
    builds: ProjectBuild[];
    failedRepositoryIds: string[];
} {
    const byKey = new Map<string, ProjectBuild>();
    const failed = new Set<string>();
    for (const page of pages) {
        for (const build of page.builds) {
            const key = buildKey(build);
            if (!byKey.has(key)) byKey.set(key, build);
        }
        for (const id of page.failedRepositoryIds) failed.add(id);
    }
    return {
        builds: sortBuildsNewestFirst([...byKey.values()]),
        failedRepositoryIds: [...failed],
    };
}

export function nextFeedPageParameter(
    lastPage: ProjectFeedPage
): FeedPageParameter | undefined {
    if (lastPage.moreRepositoryIds.length === 0) return undefined;
    return {
        page: lastPage.page + 1,
        repositoryIds: lastPage.moreRepositoryIds,
    };
}

/** Project-wide totals; `undefined` when the filtered Repository has none. */
export function pickRepositoryStats(
    stats: ProjectBuildsStats | undefined,
    filter: RepositoryFilter
): BuildsStats | undefined {
    if (!stats) return undefined;
    if (filter === ALL_REPOSITORIES) return stats.total;
    return stats.byRepository[filter];
}

export function sortBuildsNewestFirst(
    builds: readonly ProjectBuild[]
): ProjectBuild[] {
    return builds.toSorted(
        (a, b) =>
            timestamp(b.startedAt) - timestamp(a.startedAt) ||
            buildKey(a).localeCompare(buildKey(b))
    );
}

/**
 * Sum per-Repository totals. The default-branch cell reports the most urgent
 * default branch: a failure anywhere beats a run in flight, which beats a
 * pass; the newest run wins within the same status.
 */
export function sumBuildsStats(stats: readonly BuildsStats[]): BuildsStats {
    let defaultBranchBuild: ProjectBuild | undefined;
    for (const item of stats) {
        const candidate = item.defaultBranchBuild;
        if (!candidate) continue;
        if (
            !defaultBranchBuild ||
            STATUS_URGENCY[candidate.status] >
                STATUS_URGENCY[defaultBranchBuild.status] ||
            (STATUS_URGENCY[candidate.status] ===
                STATUS_URGENCY[defaultBranchBuild.status] &&
                timestamp(candidate.startedAt) >
                    timestamp(defaultBranchBuild.startedAt))
        ) {
            defaultBranchBuild = candidate;
        }
    }

    return {
        defaultBranchBuild,
        failure: stats.reduce((sum, item) => sum + item.failure, 0),
        running: stats.reduce((sum, item) => sum + item.running, 0),
        success: stats.reduce((sum, item) => sum + item.success, 0),
        total: stats.reduce((sum, item) => sum + item.total, 0),
    };
}

const STATUS_URGENCY: Record<BuildStatus, number> = {
    failure: 3,
    queued: 1,
    running: 2,
    success: 0,
};

/** Token errors are session-wide; an all-failed first load is page-level. */
function throwIfFatal(
    results: readonly PromiseSettledResult<unknown>[],
    rejectWhenAllFailed: boolean
): void {
    const reasons = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : []
    );
    const tokenError = reasons.find(
        (reason) =>
            reason instanceof CiCdMissingTokenError ||
            reason instanceof CiCdUnauthorizedError
    );
    if (tokenError) throw tokenError;
    if (
        rejectWhenAllFailed &&
        results.length > 0 &&
        reasons.length === results.length
    ) {
        throw reasons[0];
    }
}

function timestamp(iso: string): number {
    const value = Date.parse(iso);
    return Number.isNaN(value) ? 0 : value;
}
