import { useQuery } from "@tanstack/react-query";

import { fetchUserRepos } from "@/features/projects/api/github-api";

import { projectKeys } from "./query-keys";

export function useGitHubRepos(
    accessToken: null | string | undefined,
    userId: null | string | undefined,
) {
    return useQuery({
        enabled: Boolean(accessToken && userId),
        queryFn: () => fetchUserRepos(accessToken!),
        queryKey: projectKeys.githubRepos(userId ?? ""),
        staleTime: 60_000,
    });
}
