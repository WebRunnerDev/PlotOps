export const taskKeys = {
    all: ["tasks"] as const,
    archived: (projectId: string, boardId: string) =>
        [...taskKeys.all, "archived", projectId, boardId] as const,
    /** Active (non-archived) Tasks on a Board — not columns or Labels. */
    board: (projectId: string, boardId: string) =>
        [...taskKeys.all, "board", projectId, boardId] as const,
    /** Active (non-archived) Tasks across all Boards in a Project.
     * With `includeArchived: true`, the same Project list plus archived Tasks.
     */
    project: (projectId: string, includeArchived = false) =>
        [...taskKeys.all, "project", projectId, includeArchived] as const,
};
