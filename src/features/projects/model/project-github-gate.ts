/** Soft-empty branch/PR fields when the Project has no linked Repository. */
export function githubPanelNeedsRepo(
    repositories?: readonly { fullName: string }[]
): boolean {
    return !repositories?.some((repository) => repository.fullName.trim());
}

/** Whether the Project has a linked GitHub repository (non-null `github_repo_id`). */
export function projectHasGithubRepo(githubRepoId?: null | number): boolean {
    return githubRepoId != undefined;
}

/** Hash target for CI/Git “Connect a repository” → project settings. */
export function resolveProjectConnectHash(): string {
    return "connect";
}
