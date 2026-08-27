import { describe, expect, it } from "vitest";

import type { BoardColumn } from "@/features/boards";

import { remapTaskStatusForBoard } from "./remap-task-status-for-board";

const sourceColumns: BoardColumn[] = [
    { id: "todo", isDone: false, name: "To Do" },
    { id: "done", isDone: true, name: "Done" },
];

const targetColumns: BoardColumn[] = [
    { id: "backlog", isDone: false, name: "Backlog" },
    { id: "complete", isDone: true, name: "Done" },
];

describe("remapTaskStatusForBoard", () => {
    it("maps by column name when ids differ", () => {
        expect(
            remapTaskStatusForBoard("todo", sourceColumns, targetColumns)
        ).toBe("backlog");
        expect(
            remapTaskStatusForBoard("done", sourceColumns, targetColumns)
        ).toBe("complete");
    });

    it("falls back to the first target column", () => {
        expect(
            remapTaskStatusForBoard("unknown", sourceColumns, targetColumns)
        ).toBe("backlog");
    });

    it("returns the source status when the target board has no columns", () => {
        expect(remapTaskStatusForBoard("todo", sourceColumns, [])).toBe("todo");
    });
});
