export const gitKeys = {
    all: ["git"] as const,
    commitFiles: (authFingerprint: string, repoFullName: string, sha: string) =>
        [
            ...gitKeys.all,
            "commit-files",
            authFingerprint,
            repoFullName,
            sha,
        ] as const,
    commits: (
        authFingerprint: string,
        repoFullName: string,
        branchName: string
    ) =>
        [
            ...gitKeys.all,
            "commits",
            authFingerprint,
            repoFullName,
            branchName,
        ] as const,
    prChecks: (
        authFingerprint: string,
        repoFullName: string,
        prNumber: number
    ) =>
        [
            ...gitKeys.all,
            "pr-checks",
            authFingerprint,
            repoFullName,
            prNumber,
        ] as const,
    prCommits: (
        authFingerprint: string,
        repoFullName: string,
        prNumber: number
    ) =>
        [
            ...gitKeys.all,
            "pr-commits",
            authFingerprint,
            repoFullName,
            prNumber,
        ] as const,
    prFiles: (
        authFingerprint: string,
        repoFullName: string,
        prNumber: number
    ) =>
        [
            ...gitKeys.all,
            "pr-files",
            authFingerprint,
            repoFullName,
            prNumber,
        ] as const,
    pullRequests: (
        authFingerprint: string,
        repoFullName: string,
        branchName: string
    ) =>
        [
            ...gitKeys.all,
            "pull-requests",
            authFingerprint,
            repoFullName,
            branchName,
        ] as const,
    taskKeyCommits: (
        authFingerprint: string,
        repoFullName: string,
        taskKey: string
    ) =>
        [
            ...gitKeys.all,
            "task-key-commits",
            authFingerprint,
            repoFullName,
            taskKey,
        ] as const,
};

/** Stable cache scope for GitHub queries — never the raw token. */
export function gitAuthFingerprint(userId: null | string | undefined): string {
    return userId && userId.length > 0 ? userId : "anon";
}
