import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
    ListBuildsPage,
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
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isGuest } from "@/features/guest-mode";

const POLL_MS = 10_000;

export function useProjectBuilds(
    projectId: string,
    githubRepoId: null | number | undefined
) {
    const { githubAccessToken } = useAuth();
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);

    const query = useInfiniteQuery<
        ListBuildsPage,
        Error,
        { pageParams: number[]; pages: ListBuildsPage[] },
        ReturnType<typeof ciKeys.builds>,
        number
    >({
        enabled: canFetchProjectBuilds({
            githubAccessToken,
            githubRepoId,
            isGuest: guest,
            projectId,
        }),
        getNextPageParam: (lastPage) =>
            lastPage.hasMore ? lastPage.page + 1 : undefined,
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            provider.listBuilds(projectId, {
                page: pageParam,
                perPage: BUILDS_PAGE_SIZE,
            }),
        queryKey: ciKeys.builds(projectId),
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

    const builds = useMemo(
        () => query.data?.pages.flatMap((page) => page.builds) ?? [],
        [query.data]
    );

    return {
        builds,
        error: query.error,
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
