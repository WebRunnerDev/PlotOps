export const boardKeys = {
    all: ["boards"] as const,
    columns: (projectId: string, boardId: string) =>
        [...boardKeys.all, "columns", projectId, boardId] as const,
    list: (projectId: string) => [...boardKeys.all, "list", projectId] as const,
};
