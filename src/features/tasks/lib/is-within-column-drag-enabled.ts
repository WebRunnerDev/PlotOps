import type { BoardSortPreference } from "./sort-tasks-by-board-sort";

/** Within-column Manual reorder is only allowed when Board sort is Manual. */
export function isWithinColumnDragEnabled(sort: BoardSortPreference): boolean {
    return sort.field === "manual";
}
