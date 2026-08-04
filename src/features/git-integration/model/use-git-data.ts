import { useQuery } from "@tanstack/react-query";

import { isGuestSession, useAuth } from "@/features/auth";
import {
    fetchFixtureBranchCommits,
    fetchFixtureBranchPullRequests,
    fetchFixturePullRequestFiles,
} from "@/features/git-integration/api/fixture-git-api";
import {
    fetchBranchCommits,
    fetchBranchPullRequests,
    fetchPullRequestFiles,
} from "@/features/git-integration/api/github-git-api";
import {
    canFetchGitData,
    canFetchPullRequestFiles,
} from "@/features/git-integration/lib/can-fetch-git-data";

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
    const isGuest = isGuestSession(user);
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchGitData({
            branchName,
            isGuest,
            repoFullName,
            token,
        }),
        queryFn: () =>
            isGuest
                ? fetchFixtureBranchCommits(repoFullName!, branchName!)
                : fetchBranchCommits(repoFullName!, branchName!, token!),
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
    const isGuest = isGuestSession(user);
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchGitData({
            branchName,
            isGuest,
            repoFullName,
            token,
        }),
        queryFn: () =>
            isGuest
                ? fetchFixtureBranchPullRequests(repoFullName!, branchName!)
                : fetchBranchPullRequests(repoFullName!, branchName!, token!),
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
    const isGuest = isGuestSession(user);
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchPullRequestFiles({
            isGuest,
            prNumber,
            repoFullName,
            token,
        }),
        queryFn: () =>
            isGuest
                ? fetchFixturePullRequestFiles(repoFullName!, prNumber!)
                : fetchPullRequestFiles(repoFullName!, prNumber!, token!),
        queryKey: gitKeys.prFiles(
            authFingerprint,
            repoFullName ?? "",
            prNumber ?? 0
        ),
        staleTime: 5 * 60_000,
    });
}
