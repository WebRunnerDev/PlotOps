import {
    parseTaskBoardSearch,
    type TaskBoardSearch,
} from "@/features/tasks/model/task-board-search";

export type SprintsPageSearch = TaskBoardSearch & { view?: "flow" };

/** Sprints page tab: Sprints (default) or the Board's flow reports. */
export type SprintsPageView = "flow" | "sprints";

export function parseSprintsPageSearch(
    search: Record<string, unknown>
): SprintsPageSearch {
    const parsed: SprintsPageSearch = parseTaskBoardSearch(search);
    if (search.view === "flow") parsed.view = "flow";
    return parsed;
}
