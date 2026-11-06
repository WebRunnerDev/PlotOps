import { useQuery } from "@tanstack/react-query";

import { fetchGithubAppStatus } from "@/features/projects/api/github-app-status-api";

import { projectKeys } from "./query-keys";

/**
 * GitHub App installation per Repository. Off in Guest Mode and for Projects
 * without Repositories; a failure is reported as an error and never retried
 * in a loop — the settings page keeps working without it.
 */
export function useGithubAppStatus(projectId: string, enabled: boolean) {
    return useQuery({
        enabled: enabled && Boolean(projectId),
        queryFn: () => fetchGithubAppStatus(projectId),
        queryKey: projectKeys.githubAppStatus(projectId),
        retry: 1,
        staleTime: 60_000,
    });
}
