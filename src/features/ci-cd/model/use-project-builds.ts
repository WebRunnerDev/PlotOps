import { useQuery } from "@tanstack/react-query";

import { isGuestSession, useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { resolveBuildsProvider } from "@/features/ci-cd/api/resolve-builds-provider";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { ciKeys } from "@/features/ci-cd/model/query-keys";

const POLL_MS = 10_000;

export function useProjectBuilds(projectId: string) {
    const { githubAccessToken, user } = useAuth();
    const isGuest = isGuestSession(user);
    const provider = resolveBuildsProvider(isGuest);

    return useQuery({
        enabled: canFetchProjectBuilds({
            githubAccessToken,
            isGuest,
            projectId,
        }),
        queryFn: () => provider.listBuilds(projectId),
        queryKey: ciKeys.builds(projectId),
        refetchInterval: (query) =>
            hasInFlightBuilds(query.state.data) ? POLL_MS : false,
        retry: (failureCount, error) => {
            if (error instanceof CiCdMissingTokenError) return false;
            if (error instanceof CiCdUnauthorizedError) return false;
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
