import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import {
    approvePullRequest,
    closePullRequest,
    createPullRequest,
    type GitMergeMethod,
    mergePullRequest,
} from "@/features/git-integration/api/github-git-api";
import {
    gitAuthFingerprint,
    gitKeys,
} from "@/features/git-integration/model/query-keys";

export type ApprovePullRequestVariables = {
    body?: string;
    prNumber: number;
    repoFullName: string;
    token: string;
};

export type ClosePullRequestVariables = {
    headBranchName?: string;
    prNumber: number;
    repoFullName: string;
    token: string;
};

export type MergePullRequestVariables = {
    commitTitle?: string;
    headBranchName?: string;
    mergeMethod: GitMergeMethod;
    prNumber: number;
    repoFullName: string;
    token: string;
};

export function useApprovePullRequest() {
    return useMutation({
        mutationFn: (variables: ApprovePullRequestVariables) =>
            approvePullRequest({
                body: variables.body,
                prNumber: variables.prNumber,
                repoFullName: variables.repoFullName,
                token: variables.token,
            }),
    });
}

export function useClosePullRequest() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useMutation({
        mutationFn: (variables: ClosePullRequestVariables) =>
            closePullRequest({
                prNumber: variables.prNumber,
                repoFullName: variables.repoFullName,
                token: variables.token,
            }),
        onSuccess: (_data, variables) => {
            if (variables.headBranchName) {
                void queryClient.invalidateQueries({
                    queryKey: gitKeys.pullRequests(
                        authFingerprint,
                        variables.repoFullName,
                        variables.headBranchName
                    ),
                });
            }
        },
    });
}

export function useCreatePullRequest() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useMutation({
        mutationFn: createPullRequest,
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: gitKeys.pullRequests(
                    authFingerprint,
                    variables.repoFullName,
                    variables.head
                ),
            });
        },
    });
}

export function useMergePullRequest() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const authFingerprint = gitAuthFingerprint(user?.id);

    return useMutation({
        mutationFn: (variables: MergePullRequestVariables) =>
            mergePullRequest({
                commitTitle: variables.commitTitle,
                mergeMethod: variables.mergeMethod,
                prNumber: variables.prNumber,
                repoFullName: variables.repoFullName,
                token: variables.token,
            }),
        onSuccess: (_data, variables) => {
            if (variables.headBranchName) {
                void queryClient.invalidateQueries({
                    queryKey: gitKeys.pullRequests(
                        authFingerprint,
                        variables.repoFullName,
                        variables.headBranchName
                    ),
                });
            }
        },
    });
}
