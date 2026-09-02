export type TaskBoardSearch = {
    task?: string;
};

export function parseTaskBoardSearch(
    search: Record<string, unknown>
): TaskBoardSearch {
    if (typeof search.task !== "string") {
        return {};
    }

    const task = search.task.trim();
    return task.length > 0 ? { task } : {};
}
