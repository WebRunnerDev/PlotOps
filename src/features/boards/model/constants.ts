import type { BoardColumn } from "./types";

/** Default statuses — each is a kanban column. Names are editable on the board. */
export const DEFAULT_KANBAN_COLUMNS: BoardColumn[] = [
    { id: "todo", name: "To Do" },
    { id: "in_progress", name: "In Progress" },
    { id: "in_review", name: "In Review" },
    { id: "done", name: "Done" },
];

export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;
