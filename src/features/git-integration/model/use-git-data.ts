import { useQueries, useQuery } from "@tanstack/react-query";

import type { GitCommit } from "@/features/git-integration/api/github-git-api";

import { useAuth } from "@/features/auth";
import {
    fetchFixtureBranchCommits,
    fetchFixtureBranchPullRequests,
    fetchFixtureCommitBySha,
    fetchFixtureCommitFiles,
    fetchFixturePullRequestChecks,
    fetchFixturePullRequestCommits,
    fetchFixturePullRequestFiles,
    fetchFixtureTaskKeyCommits,
} from "@/features/git-integration/api/fixture-git-api";
import {
    fetchBranchCommits,
    fetchBranchPullRequests,
    fetchCommitBySha,
    fetchCommitFiles,
    fetchPullRequestChecks,
    fetchPullRequestCommits,
    fetchPullRequestFiles,
    fetchPullRequestReviewerCandidates,
    searchCommitsByTaskKey,
} from "@/features/git-integration/api/github-git-api";
import {
    canFetchGitData,
    canFetchPullRequestChecks,
    canFetchPullRequestFiles,
    canFetchTaskGitTab,
} from "@/features/git-integration/lib/can-fetch-git-data";
import {
    mergeRepositoryCommits,
    type RepositoryCommit,
} from "@/features/git-integration/lib/merge-commits";
import { isGuest } from "@/features/guest-mode";

import { gitAuthFingerprint, gitKeys } from "./query-keys";

type GitQueryOptions = {
    branchName: string | undefined;
    repoFullName: string | undefined;
    token: null | string;
};

type TaskCommitsOptions<R extends TaskCommitsRepository> = {
    linkedCommitSha: string | undefined;
    repositories: readonly R[];
    taskKey: string;
    token: null | string;
};

type TaskCommitsRepository = {
    /** Linked branch of this Repository; shared branches are skipped. */
    branchName: string | undefined;
    fullName: string;
    id: string;
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

export function usePullRequestChecks(
    repoFullName: string | undefined,
    prNumber: number | undefined,
    token: null | string
) {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useQuery({
        enabled: canFetchPullRequestChecks({
            isGuest: guest,
            prNumber,
            repoFullName,
            token,
        }),
        queryFn: () =>
            guest
                ? fetchFixturePullRequestChecks(repoFullName!, prNumber!)
                : fetchPullRequestChecks(repoFullName!, prNumber!, token!),
        queryKey: gitKeys.prChecks(
            authFingerprint,
            repoFullName ?? "",
            prNumber ?? 0
        ),
        refetchInterval: (query) =>
            query.state.data?.rollup === "pending" ? 15_000 : false,
        staleTime: 30_000,
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

/** Reviewer picker data — never fetched for guests (request-review is hidden). */
export function usePullRequestReviewerCandidates(
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
            !guest &&
            Boolean(token && repoFullName && prNumber !== undefined),
        queryFn: ({ signal }) =>
            fetchPullRequestReviewerCandidates(
                repoFullName!,
                prNumber!,
                token!,
                signal
            ),
        queryKey: gitKeys.prReviewers(
            authFingerprint,
            repoFullName ?? "",
            prNumber ?? 0
        ),
        staleTime: 60_000,
    });
}

/**
 * Every commit of a Task across its Repositories — smart commits by Task
 * key, branch commits and the manually linked commit — as one list tagged
 * with the Repository. Shares cache keys with the single-Repository hooks.
 */
export function useTaskCommits<R extends TaskCommitsRepository>({
    linkedCommitSha,
    repositories,
    taskKey,
    token,
}: TaskCommitsOptions<R>): {
    commits: RepositoryCommit<R>[];
    enabled: boolean;
    isError: boolean;
    isLoading: boolean;
    refetch: () => void;
} {
    const { user } = useAuth();
    const guest = isGuest();
    const authFingerprint = gitAuthFingerprint(user?.id);
    const hasAuth = Boolean(token) || guest;

    const queries = repositories.flatMap((repository) => {
        const repoFullName = repository.fullName;
        const branchName = repository.branchName;
        return [
            {
                enabled: canFetchTaskGitTab({
                    isGuest: guest,
                    repoFullName,
                    taskKey,
                    token,
                }),
                queryFn: () =>
                    guest
                        ? fetchFixtureTaskKeyCommits(repoFullName, taskKey)
                        : searchCommitsByTaskKey(repoFullName, taskKey, token!),
                queryKey: gitKeys.taskKeyCommits(
                    authFingerprint,
                    repoFullName,
                    taskKey
                ),
                staleTime: 60_000,
            },
            {
                enabled: canFetchGitData({
                    branchName,
                    isGuest: guest,
                    repoFullName,
                    token,
                }),
                queryFn: () =>
                    guest
                        ? fetchFixtureBranchCommits(repoFullName, branchName!)
                        : fetchBranchCommits(repoFullName, branchName!, token!),
                queryKey: gitKeys.commits(
                    authFingerprint,
                    repoFullName,
                    branchName ?? ""
                ),
                staleTime: 60_000,
            },
            {
                enabled: Boolean(hasAuth && linkedCommitSha),
                queryFn: async (): Promise<GitCommit[]> => [
                    guest
                        ? await fetchFixtureCommitBySha(
                              repoFullName,
                              linkedCommitSha!
                          )
                        : await fetchCommitBySha(
                              repoFullName,
                              linkedCommitSha!,
                              token!
                          ),
                ],
                queryKey: [
                    ...gitKeys.all,
                    "linked-commit-list",
                    authFingerprint,
                    repoFullName,
                    linkedCommitSha ?? "",
                ] as const,
                // A 404 only means the commit lives in another Repository.
                retry: false,
                staleTime: 5 * 60_000,
            },
        ];
    });

    const results = useQueries({ queries });

    const sources = repositories.map((repository, index) => {
        const [keyCommits, branchCommits, linked] = results.slice(
            index * 3,
            index * 3 + 3
        );
        return {
            commits: [
                ...(linked?.data ?? []),
                ...(keyCommits?.data ?? []),
                ...(branchCommits?.data ?? []),
            ],
            repository,
        };
    });
    // The linked-commit lookup 404s in every Repository but one — not an error.
    const listResults = results.filter((_, index) => index % 3 !== 2);

    return {
        commits: mergeRepositoryCommits(sources, linkedCommitSha),
        enabled: queries.some((query) => query.enabled),
        isError: listResults.some((result) => result.isError),
        isLoading: results.some((result) => result.isLoading),
        refetch: () => {
            for (const result of results) {
                void result.refetch();
            }
        },
    };
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
