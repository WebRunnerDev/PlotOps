import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import {
    fetchFixtureBranchCommits,
    fetchFixtureBranchPullRequests,
    fetchFixtureCommitBySha,
    fetchFixtureCommitFiles,
    fetchFixturePullRequestCommits,
    fetchFixturePullRequestFiles,
    fetchFixtureTaskKeyCommits,
} from "@/features/git-integration/api/fixture-git-api";
import {
    fetchBranchCommits,
    fetchBranchPullRequests,
    fetchCommitBySha,
    fetchCommitFiles,
    fetchPullRequestCommits,
    fetchPullRequestFiles,
    searchCommitsByTaskKey,
} from "@/features/git-integration/api/github-git-api";
import {
    canFetchGitData,
    canFetchPullRequestFiles,
    canFetchTaskGitTab,
} from "@/features/git-integration/lib/can-fetch-git-data";
import { isGuest } from "@/features/guest-mode";

import { gitAuthFingerprint, gitKeys } from "./query-keys";

type GitQueryOptions = {
    branchName: string | undefined;
    repoFullName: string | undefined;
    token: null | string;
};

type TaskKeyCommitsOptions = {
    repoFullName: string | undefined;
    taskKey: string | undefined;
    token: null | string;
};

export function useBranchCommits({
    branchName,
    repoFullName,
    token,
}: GitQueryOptions) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchGitData({
            branchName,
            isGuest: guest,
            repoFullName,
            token,
        }),
        queryFn: () =>
            guest
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
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchGitData({
            branchName,
            isGuest: guest,
            repoFullName,
            token,
        }),
        queryFn: () =>
            guest
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

export function useCommitFiles(
    repoFullName: string | undefined,
    sha: string | undefined,
    token: null | string,
    enabled = true
) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);
    const hasAuth = Boolean(token) || guest;

    return useQuery({
        enabled: Boolean(enabled && hasAuth && repoFullName && sha),
        queryFn: () =>
            guest
                ? fetchFixtureCommitFiles(repoFullName!, sha!)
                : fetchCommitFiles(repoFullName!, sha!, token!),
        queryKey: gitKeys.commitFiles(
            authFingerprint,
            repoFullName ?? "",
            sha ?? ""
        ),
        staleTime: 5 * 60_000,
    });
}

export function useLinkedCommit(
    repoFullName: string | undefined,
    sha: string | undefined,
    token: null | string
) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);
    const hasAuth = Boolean(token) || guest;

    return useQuery({
        enabled: Boolean(hasAuth && repoFullName && sha),
        queryFn: () =>
            guest
                ? fetchFixtureCommitBySha(repoFullName!, sha!)
                : fetchCommitBySha(repoFullName!, sha!, token!),
        queryKey: [
            ...gitKeys.all,
            "linked-commit",
            authFingerprint,
            repoFullName ?? "",
            sha ?? "",
        ] as const,
        staleTime: 5 * 60_000,
    });
}

export function usePullRequestCommits(
    repoFullName: string | undefined,
    prNumber: number | undefined,
    token: null | string,
    enabled = true
) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled:
            enabled &&
            canFetchPullRequestFiles({
                isGuest: guest,
                prNumber,
                repoFullName,
                token,
            }),
        queryFn: () =>
            guest
                ? fetchFixturePullRequestCommits(repoFullName!, prNumber!)
                : fetchPullRequestCommits(repoFullName!, prNumber!, token!),
        queryKey: gitKeys.prCommits(
            authFingerprint,
            repoFullName ?? "",
            prNumber ?? 0
        ),
        staleTime: 5 * 60_000,
    });
}

export function usePullRequestFiles(
    repoFullName: string | undefined,
    prNumber: number | undefined,
    token: null | string
) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchPullRequestFiles({
            isGuest: guest,
            prNumber,
            repoFullName,
            token,
        }),
        queryFn: () =>
            guest
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

export function useTaskKeyCommits({
    repoFullName,
    taskKey,
    token,
}: TaskKeyCommitsOptions) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchTaskGitTab({
            isGuest: guest,
            repoFullName,
            taskKey,
            token,
        }),
        queryFn: () =>
            guest
                ? fetchFixtureTaskKeyCommits(repoFullName!, taskKey!)
                : searchCommitsByTaskKey(repoFullName!, taskKey!, token!),
        queryKey: gitKeys.taskKeyCommits(
            authFingerprint,
            repoFullName ?? "",
            taskKey ?? ""
        ),
        staleTime: 60_000,
    });
}
