export const boardKeys = {
    all: ["boards"] as const,
    columns: (projectId: string, boardId: string) =>
        [...boardKeys.all, "columns", projectId, boardId] as const,
    list: (projectId: string) => [...boardKeys.all, "list", projectId] as const,
};

export const labelKeys = {
    all: ["labels"] as const,
    project: (projectId: string) =>
        [...labelKeys.all, "project", projectId] as const,
};

export const sprintKeys = {
    all: ["sprints"] as const,
    board: (boardId: string) => [...sprintKeys.all, "board", boardId] as const,
    events: (sprintId: string) =>
        [...sprintKeys.all, "events", sprintId] as const,
};

export const taskKeys = {
    all: ["tasks"] as const,
    archived: (projectId: string, boardId: string) =>
        [...taskKeys.all, "archived", projectId, boardId] as const,
    /** Active (non-archived) Tasks on a Board — not columns or Labels. */
    board: (projectId: string, boardId: string) =>
        [...taskKeys.all, "board", projectId, boardId] as const,
};
