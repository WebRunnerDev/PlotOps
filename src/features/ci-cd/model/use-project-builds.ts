import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
    FeedPageParameter,
    ProjectFeedPage,
} from "@/features/ci-cd/model/project-feed";
import type {
    BuildsRepository,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { BUILDS_PAGE_SIZE } from "@/features/ci-cd/model/builds-page";
import {
    firstFeedPageParameter,
    listProjectFeedPage,
    mergeFeedPages,
    nextFeedPageParameter,
} from "@/features/ci-cd/model/project-feed";
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isGuest } from "@/features/guest-mode";

const POLL_MS = 10_000;

/**
 * One feed of workflow runs across every Repository of the Project,
 * newest first (ADR 0035). `failedRepositoryIds` lists Repositories whose
 * runs could not be loaded while the others still show.
 */
export function useProjectBuilds(
    projectId: string,
    repositories: readonly BuildsRepository[]
) {
    const { githubAccessToken } = useAuth();
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);

    const query = useInfiniteQuery<
        ProjectFeedPage,
        Error,
        { pageParams: FeedPageParameter[]; pages: ProjectFeedPage[] },
        ReturnType<typeof ciKeys.builds>,
        FeedPageParameter
    >({
        enabled: canFetchProjectBuilds({
            githubAccessToken,
            isGuest: guest,
            projectId,
            repositoryCount: repositories.length,
        }),
        getNextPageParam: (lastPage) => nextFeedPageParameter(lastPage),
        initialPageParam: firstFeedPageParameter(repositories),
        queryFn: ({ pageParam }) =>
            listProjectFeedPage(
                provider,
                repositories,
                pageParam,
                BUILDS_PAGE_SIZE
            ),
        queryKey: ciKeys.builds(
            projectId,
            repositories.map((repository) => repository.id)
        ),
        refetchInterval: (infiniteQuery) =>
            hasInFlightBuilds(
                infiniteQuery.state.data?.pages.flatMap((page) => page.builds)
            )
                ? POLL_MS
                : false,
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 15_000,
    });

    const feed = useMemo(
        () => mergeFeedPages(query.data?.pages ?? []),
        [query.data]
    );

    return {
        builds: feed.builds,
        error: query.error,
        failedRepositoryIds: feed.failedRepositoryIds,
        fetchNextPage: query.fetchNextPage,
        hasNextPage: Boolean(query.hasNextPage),
        isFetching: query.isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
        isLoading: query.isLoading,
    };
}

function hasInFlightBuilds(builds: ProjectBuild[] | undefined): boolean {
    if (!builds) return false;
    return builds.some(
        (build) => build.status === "queued" || build.status === "running"
    );
}
