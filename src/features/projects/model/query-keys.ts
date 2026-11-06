export const projectKeys = {
    all: ["projects"] as const,
    detail: (projectId: string) =>
        [...projectKeys.all, "detail", projectId] as const,
    githubAppStatus: (projectId: string) =>
        [...projectKeys.detail(projectId), "github-app-status"] as const,
    githubRepos: (userId: string) =>
        ["projects", "github-repos", userId] as const,
    list: () => [...projectKeys.all, "list"] as const,
    listByTeam: (teamId: string) =>
        [...projectKeys.all, "list", "team", teamId] as const,
    myMembership: (projectId: string, userId: string | undefined) =>
        [...projectKeys.detail(projectId), "my-membership", userId] as const,
    repositoryGitLinkCount: (repositoryId: string) =>
        [...projectKeys.all, "repository-git-links", repositoryId] as const,
};
