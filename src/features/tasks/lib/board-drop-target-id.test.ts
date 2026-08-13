import { describe, expect, it } from "vitest";

import {
    columnTaskDropId,
    resolveBoardDropTargetId,
} from "./board-drop-target-id";

describe("columnTaskDropId", () => {
    it("builds a stable droppable id for column task lists", () => {
        expect(columnTaskDropId("todo")).toBe("column-tasks:todo");
    });
});

describe("resolveBoardDropTargetId", () => {
    it("maps column task-list droppables back to column ids", () => {
        expect(resolveBoardDropTargetId("column-tasks:doing")).toBe("doing");
    });

    it("passes through task and column ids unchanged", () => {
        expect(resolveBoardDropTargetId("task-1")).toBe("task-1");
        expect(resolveBoardDropTargetId("done")).toBe("done");
    });
});
