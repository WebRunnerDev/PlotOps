export const boardKeys = {
    all: ["boards"] as const,
    columns: (projectId: string, boardId: string) =>
        [...boardKeys.all, "columns", projectId, boardId] as const,
    list: (projectId: string) => [...boardKeys.all, "list", projectId] as const,
};

/** @deprecated Import from `@/features/labels` — temporary shim. */
export { labelKeys } from "@/features/labels/model/query-keys";

export const taskKeys = {
    all: ["tasks"] as const,
    archived: (projectId: string, boardId: string) =>
        [...taskKeys.all, "archived", projectId, boardId] as const,
    /** Active (non-archived) Tasks on a Board — not columns or Labels. */
    board: (projectId: string, boardId: string) =>
        [...taskKeys.all, "board", projectId, boardId] as const,
};
