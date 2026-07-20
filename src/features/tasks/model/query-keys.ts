export const taskKeys = {
    all: ["tasks"] as const,
    board: (projectId: string) => [...taskKeys.all, "board", projectId] as const,
};
