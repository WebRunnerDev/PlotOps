import type { BoardColumn } from "./types";

/** Default statuses — each is a kanban column. Names are editable on the board. */
export const DEFAULT_KANBAN_COLUMNS: BoardColumn[] = [
    { id: "todo", isDone: false, name: "To Do" },
    { id: "in_progress", isDone: false, name: "In Progress" },
    { id: "in_review", isDone: false, name: "In Review" },
    { id: "done", isDone: true, name: "Done" },
];

export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;
