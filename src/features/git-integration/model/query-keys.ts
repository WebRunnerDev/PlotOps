export const gitKeys = {
    all: ["git"] as const,
    commits: (repoFullName: string, branchName: string) =>
        [...gitKeys.all, "commits", repoFullName, branchName] as const,
    prFiles: (repoFullName: string, prNumber: number) =>
        [...gitKeys.all, "pr-files", repoFullName, prNumber] as const,
    pullRequests: (repoFullName: string, branchName: string) =>
        [...gitKeys.all, "pull-requests", repoFullName, branchName] as const,
};
