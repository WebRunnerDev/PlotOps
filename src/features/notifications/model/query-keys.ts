export const notificationsKeys = {
    all: ["notifications"] as const,

    list: (input: {
        limit?: number;
        offset?: number;
        projectId?: string;
        q?: string;
    }) =>
        [
            ...notificationsKeys.all,
            "list",
            input.projectId ?? "all",
            input.q ?? "",
            input.limit ?? 20,
            input.offset ?? 0,
        ] as const,

    taskWatchers: (input: { projectId: string; taskId: string }) =>
        [
            ...notificationsKeys.all,
            "taskWatchers",
            input.projectId,
            input.taskId,
        ] as const,

    unreadCount: (projectId?: string) =>
        [...notificationsKeys.all, "unreadCount", projectId ?? "all"] as const,
};
