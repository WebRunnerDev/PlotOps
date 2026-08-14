import { describe, expect, it } from "vitest";

import {
    parentSubtaskProgress,
    visibleBoardTasks,
} from "./board-subtask-visibility";

describe("visibleBoardTasks", () => {
    const parent: { id: string; parentId?: string; sprintId?: string } = {
        id: "parent",
        sprintId: "sprint-1",
    };
    const child: { id: string; parentId?: string; sprintId?: string } = {
        id: "child",
        parentId: "parent",
        sprintId: "sprint-1",
    };
    const root: { id: string; parentId?: string } = { id: "root" };

    it("shows Subtasks by default", () => {
        expect(visibleBoardTasks([parent, child, root], false)).toEqual([
            parent,
            child,
            root,
        ]);
    });

    it("hides Subtasks and leaves root Tasks", () => {
        expect(visibleBoardTasks([parent, child, root], true)).toEqual([
            parent,
            root,
        ]);
    });

    it("does not mutate Manual order or Sprint membership on the source list", () => {
        const tasks = [parent, child, root];
        const snapshot = structuredClone(tasks);

        visibleBoardTasks(tasks, true);

        expect(tasks).toEqual(snapshot);
        expect(child.sprintId).toBe("sprint-1");
    });
});

describe("parentSubtaskProgress", () => {
    it("returns undefined when the Task has no Subtasks", () => {
        expect(
            parentSubtaskProgress("parent", [{ id: "parent", isDone: false }])
        ).toBeUndefined();
    });

    it("counts Done Subtasks against the total", () => {
        expect(
            parentSubtaskProgress("parent", [
                { id: "parent", isDone: false },
                { id: "a", isDone: true, parentId: "parent" },
                { id: "b", isDone: false, parentId: "parent" },
                { id: "c", isDone: true, parentId: "parent" },
                { id: "other", isDone: true, parentId: "elsewhere" },
            ])
        ).toEqual({ done: 2, total: 3 });
    });
});
