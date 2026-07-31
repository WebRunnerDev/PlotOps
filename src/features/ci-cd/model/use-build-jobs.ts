import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { buildsProvider } from "@/features/ci-cd/api/builds-provider";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";

export function useBuildJobs(
    projectId: string,
    buildId: string | undefined,
    enabled: boolean
) {
    const { githubAccessToken } = useAuth();

    return useQuery({
        enabled: Boolean(enabled && projectId && buildId && githubAccessToken),
        queryFn: () => buildsProvider.listBuildJobs(projectId, buildId!),
        queryKey: ciKeys.jobs(projectId, buildId ?? ""),
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
            return failureCount < 2;
        },
        staleTime: 10_000,
    });
}
