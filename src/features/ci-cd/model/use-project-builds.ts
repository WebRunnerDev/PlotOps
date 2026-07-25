import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import { buildsProvider } from "@/features/ci-cd/api/builds-provider";
import { CiCdMissingTokenError } from "@/features/ci-cd/api/github-actions-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";

const POLL_MS = 10_000;

export function useProjectBuilds(projectId: string) {
    const { githubAccessToken } = useAuth();

    return useQuery({
        enabled: Boolean(projectId && githubAccessToken),
        queryFn: () => buildsProvider.listBuilds(projectId),
        queryKey: ciKeys.builds(projectId),
        refetchInterval: (query) =>
            hasInFlightBuilds(query.state.data) ? POLL_MS : false,
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            return failureCount < 2;
        },
        staleTime: 15_000,
    });
}

function hasInFlightBuilds(builds: undefined | { status: string }[]): boolean {
    if (!builds) return false;
    return builds.some(
        (build) => build.status === "queued" || build.status === "running"
    );
}
