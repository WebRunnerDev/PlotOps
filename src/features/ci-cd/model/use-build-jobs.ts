import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";
import { isGuest } from "@/features/guest-mode";

export function useBuildJobs(
    projectId: string,
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
            }),
        queryFn: () => provider.listBuildJobs(projectId, buildId!),
        queryKey: ciKeys.jobs(projectId, buildId ?? ""),
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 10_000,
    });
}
