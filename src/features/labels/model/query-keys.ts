export const labelKeys = {
    all: ["labels"] as const,
    project: (projectId: string) =>
        [...labelKeys.all, "project", projectId] as const,
    /** Settings usage only — not part of the Labels Realtime primary path. */
    taggedTasks: (projectId: string) =>
        [...labelKeys.project(projectId), "tagged-tasks"] as const,
};
