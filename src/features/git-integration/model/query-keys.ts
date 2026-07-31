export const gitKeys = {
    all: ["git"] as const,
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
};

/** Stable cache scope for GitHub queries — never the raw token. */
export function gitAuthFingerprint(userId: null | string | undefined): string {
    return userId && userId.length > 0 ? userId : "anon";
}
