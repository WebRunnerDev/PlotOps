import { useQuery } from "@tanstack/react-query";

import {
    fetchBranchCommits,
    fetchBranchPullRequests,
    fetchPullRequestFiles,
} from "@/features/git-integration/api/github-git-api";

import { gitKeys } from "./query-keys";

type GitQueryOptions = {
    branchName: string | undefined;
    repoFullName: string | undefined;
    token: string | null;
};

export function useBranchCommits({
    branchName,
    repoFullName,
    token,
}: GitQueryOptions) {
    return useQuery({
        enabled: Boolean(token && repoFullName && branchName),
        queryFn: () =>
            fetchBranchCommits(repoFullName!, branchName!, token!),
        queryKey: gitKeys.commits(repoFullName ?? "", branchName ?? ""),
        staleTime: 60_000,
    });
}

export function useBranchPullRequests({
    branchName,
    repoFullName,
    token,
}: GitQueryOptions) {
    return useQuery({
        enabled: Boolean(token && repoFullName && branchName),
        queryFn: () =>
            fetchBranchPullRequests(repoFullName!, branchName!, token!),
        queryKey: gitKeys.pullRequests(repoFullName ?? "", branchName ?? ""),
        staleTime: 60_000,
    });
}

export function usePullRequestFiles(
    repoFullName: string | undefined,
    prNumber: number | undefined,
    token: string | null,
) {
    return useQuery({
        enabled: Boolean(token && repoFullName && prNumber != null),
        queryFn: () =>
            fetchPullRequestFiles(repoFullName!, prNumber!, token!),
        queryKey: gitKeys.prFiles(repoFullName ?? "", prNumber ?? 0),
        staleTime: 5 * 60_000,
    });
}
