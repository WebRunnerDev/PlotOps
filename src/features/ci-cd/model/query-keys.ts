export const ciKeys = {
    all: ["ci-cd"] as const,
    builds: (projectId: string) =>
        [...ciKeys.all, "builds", projectId] as const,
};
