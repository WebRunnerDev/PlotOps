/** Soft-empty branch/PR fields when the Project has no linked repo full name. */
export function githubPanelNeedsRepo(
    repoFullName: string | undefined
): boolean {
    return !repoFullName?.trim();
}

/** Whether the Project has a linked GitHub repository (non-null `github_repo_id`). */
export function projectHasGithubRepo(
    githubRepoId: null | number | undefined
): boolean {
    return githubRepoId != undefined;
}

/** Hash target for CI/Git “Connect a repository” → project settings. */
export function resolveProjectConnectHash(): string {
    return "connect";
}
