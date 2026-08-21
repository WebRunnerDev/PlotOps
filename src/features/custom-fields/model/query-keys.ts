export const customFieldKeys = {
    all: ["custom-fields"] as const,
    project: (projectId: string) =>
        [...customFieldKeys.all, "project", projectId] as const,
    taskValues: (taskId: string) =>
        [...customFieldKeys.all, "task-values", taskId] as const,
    /** Settings usage only — Tasks that have values for Project definitions. */
    valueUsage: (projectId: string) =>
        [...customFieldKeys.project(projectId), "value-usage"] as const,
};
