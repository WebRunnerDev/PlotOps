import { useQuery } from "@tanstack/react-query";

import type { ProjectBuildsStats } from "@/features/ci-cd/model/project-feed";
import type { BuildsRepository } from "@/features/ci-cd/model/types";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { getProjectBuildsStats } from "@/features/ci-cd/model/project-feed";
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isGuest } from "@/features/guest-mode";

const POLL_MS = 10_000;

/**
 * Repo-wide run totals for the summary cells, per Repository and summed.
 *
 * Kept separate from `useProjectBuilds` on purpose: the list is paginated, so
 * counting its pages would make the summary climb as the reader scrolls.
 */
export function useBuildsStats(
    projectId: string,
    repositories: readonly BuildsRepository[]
) {
    const { githubAccessToken } = useAuth();
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);

    const query = useQuery<ProjectBuildsStats>({
        enabled: canFetchProjectBuilds({
            githubAccessToken,
            isGuest: guest,
            projectId,
            repositoryCount: repositories.length,
        }),
        queryFn: () => getProjectBuildsStats(provider, repositories),
        queryKey: ciKeys.stats(
            projectId,
            repositories
                .map(
                    (repository) =>
                        `${repository.id}@${repository.defaultBranch}`
                )
                .join(",")
        ),
        refetchInterval: (statsQuery) =>
            (statsQuery.state.data?.total.running ?? 0) > 0 ? POLL_MS : false,
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 15_000,
    });

    return {
        isLoading: query.isLoading,
        stats: query.data,
    };
}
