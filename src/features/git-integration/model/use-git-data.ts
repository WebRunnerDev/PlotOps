import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import {
    fetchBranchCommits,
    fetchBranchPullRequests,
    fetchPullRequestFiles,
} from "@/features/git-integration/api/github-git-api";

import { gitAuthFingerprint, gitKeys } from "./query-keys";

type GitQueryOptions = {
    branchName: string | undefined;
    repoFullName: string | undefined;
    token: null | string;
};

export function useBranchCommits({
    branchName,
    repoFullName,
    token,
}: GitQueryOptions) {
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: Boolean(token && repoFullName && branchName),
        queryFn: () => fetchBranchCommits(repoFullName!, branchName!, token!),
        queryKey: gitKeys.commits(
            authFingerprint,
            repoFullName ?? "",
            branchName ?? ""
        ),
        staleTime: 60_000,
    });
}

export function useBranchPullRequests({
    branchName,
    repoFullName,
    token,
}: GitQueryOptions) {
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: Boolean(token && repoFullName && branchName),
        queryFn: () =>
            fetchBranchPullRequests(repoFullName!, branchName!, token!),
        queryKey: gitKeys.pullRequests(
            authFingerprint,
            repoFullName ?? "",
            branchName ?? ""
        ),
        staleTime: 60_000,
    });
}

export function usePullRequestFiles(
    repoFullName: string | undefined,
    prNumber: number | undefined,
    token: null | string
) {
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: Boolean(token && repoFullName && prNumber != undefined),
        queryFn: () => fetchPullRequestFiles(repoFullName!, prNumber!, token!),
        queryKey: gitKeys.prFiles(
            authFingerprint,
            repoFullName ?? "",
            prNumber ?? 0
        ),
        staleTime: 5 * 60_000,
    });
}
