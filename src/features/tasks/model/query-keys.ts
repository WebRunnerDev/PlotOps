export const boardKeys = {
    all: ["boards"] as const,
    list: (projectId: string) => [...boardKeys.all, "list", projectId] as const,
};

export const taskKeys = {
    all: ["tasks"] as const,
    archived: (projectId: string, boardId: string) =>
        [...taskKeys.all, "archived", projectId, boardId] as const,
    board: (projectId: string, boardId: string) =>
        [...taskKeys.all, "board", projectId, boardId] as const,
};
