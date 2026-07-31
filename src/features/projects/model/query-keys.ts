export const projectKeys = {
    all: ["projects"] as const,
    detail: (projectId: string) =>
        [...projectKeys.all, "detail", projectId] as const,
    githubRepos: (userId: string) =>
        ["projects", "github-repos", userId] as const,
    list: () => [...projectKeys.all, "list"] as const,
    myMembership: (projectId: string, userId: string | undefined) =>
        [...projectKeys.detail(projectId), "my-membership", userId] as const,
};
