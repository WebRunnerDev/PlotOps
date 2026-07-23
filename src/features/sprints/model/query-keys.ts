export const sprintKeys = {
    all: ["sprints"] as const,
    board: (boardId: string) => [...sprintKeys.all, "board", boardId] as const,
    events: (sprintId: string) =>
        [...sprintKeys.all, "events", sprintId] as const,
};
