import { useQuery } from "@tanstack/react-query";

import type { BuildsRepository } from "@/features/ci-cd/model/types";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isGuest } from "@/features/guest-mode";

/** Jobs of one run, read from the Repository the run belongs to. */
export function useBuildJobs(
    projectId: string,
    repository: BuildsRepository | undefined,
    buildId: string | undefined,
    enabled: boolean
) {
    const { githubAccessToken } = useAuth();
    const guest = isGuest();
    const provider = resolveBuildsProvider(guest);

    return useQuery({
        enabled:
            enabled &&
            Boolean(buildId) &&
            canFetchProjectBuilds({
                githubAccessToken,
                isGuest: guest,
                projectId,
                repositoryCount: repository ? 1 : 0,
            }),
        queryFn: () => provider.listBuildJobs(repository!, buildId!),
        queryKey: ciKeys.jobs(projectId, repository?.id ?? "", buildId ?? ""),
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 10_000,
    });
}
