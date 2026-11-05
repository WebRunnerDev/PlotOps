export const ciKeys = {
    all: ["ci-cd"] as const,
    /** Keyed by the Repository set so linking or unlinking one refetches. */
    builds: (projectId: string, repositoryIds: readonly string[]) =>
        [...ciKeys.all, "builds", projectId, repositoryIds.join(",")] as const,
    jobs: (projectId: string, repositoryId: string, buildId: string) =>
        [...ciKeys.all, "jobs", projectId, repositoryId, buildId] as const,
    stats: (projectId: string, repositoryKey: string) =>
        [...ciKeys.all, "stats", projectId, repositoryKey] as const,
};
