import { useQuery } from "@tanstack/react-query";

import type {
    BuildsRepository,
    BuildStatus,
} from "@/features/ci-cd/model/types";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isInFlightStatus } from "@/features/ci-cd/model/use-job-log-stream";
import { isGuest } from "@/features/guest-mode";

const IN_FLIGHT_REFETCH_MS = 5000;

/**
 * Jobs of one run, read from the Repository the run belongs to. Refetched
 * while the run is in flight so each job's status (and its log poll) moves on.
 */
export function useBuildJobs(
    projectId: string,
    repository: BuildsRepository | undefined,
    buildId: string | undefined,
    enabled: boolean,
    buildStatus?: BuildStatus
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
        refetchInterval: isInFlightStatus(buildStatus)
            ? IN_FLIGHT_REFETCH_MS
            : false,
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 10_000,
    });
}
