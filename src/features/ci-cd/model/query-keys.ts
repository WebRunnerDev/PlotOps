export const ciKeys = {
    all: ["ci-cd"] as const,
    builds: (projectId: string) =>
        [...ciKeys.all, "builds", projectId] as const,
    jobs: (projectId: string, buildId: string) =>
        [...ciKeys.all, "jobs", projectId, buildId] as const,
};
