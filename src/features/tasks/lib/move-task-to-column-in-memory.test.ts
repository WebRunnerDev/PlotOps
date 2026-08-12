import { describe, expect, it } from "vitest";

import type { BoardColumn } from "@/features/boards";
import type { Task } from "@/features/tasks/model/types";

import { moveTasksToColumnInMemory } from "./move-task-to-column-in-memory";

function column(id: string): BoardColumn {
    return {
        id,
        isDone: false,
        name: id,
    };
}

function task(id: string, status: Task["status"]): Task {
    return {
        boardId: "board",
        createdAt: "2026-01-01T00:00:00.000Z",
        id,
        key: id.toUpperCase(),
        status,
        title: id,
        type: "task",
    };
}

describe("moveTasksToColumnInMemory", () => {
    const columns = [column("todo"), column("doing"), column("done")];

    it("moves a single task across columns", () => {
        const tasks = [
            task("a", "todo"),
            task("b", "todo"),
            task("c", "doing"),
        ];
        const result = moveTasksToColumnInMemory(
            tasks,
            columns,
            ["a"],
            "doing"
        );
        expect(result?.tasks.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
        expect(result?.tasks.find((entry) => entry.id === "a")?.status).toBe(
            "doing"
        );
    });

    it("moves a multi-selection as a block preserving relative order", () => {
        const tasks = [
            task("a", "todo"),
            task("b", "todo"),
            task("c", "doing"),
            task("d", "todo"),
        ];
        const result = moveTasksToColumnInMemory(
            tasks,
            columns,
            ["d", "a"],
            "doing"
        );
        expect(
            result?.tasks.map((entry) => `${entry.id}:${entry.status}`)
        ).toEqual(["b:todo", "c:doing", "a:doing", "d:doing"]);
    });

    it("no-ops when every selected task is already in the target column", () => {
        const tasks = [task("a", "doing"), task("b", "doing")];
        expect(
            moveTasksToColumnInMemory(tasks, columns, ["a", "b"], "doing")
        ).toBeUndefined();
    });

    it("skips members already in the target and moves the rest", () => {
        const tasks = [
            task("a", "todo"),
            task("b", "doing"),
            task("c", "todo"),
        ];
        const result = moveTasksToColumnInMemory(
            tasks,
            columns,
            ["a", "b", "c"],
            "doing"
        );
        expect(
            result?.tasks.map((entry) => `${entry.id}:${entry.status}`)
        ).toEqual(["b:doing", "a:doing", "c:doing"]);
    });

    it("inserts before a visible neighbor while hidden siblings keep their slots", () => {
        const tasks = [
            task("a", "todo"),
            task("hidden", "todo"),
            task("c", "todo"),
            task("incoming", "doing"),
        ];
        const displayed = new Set(["a", "c", "incoming"]);

        const result = moveTasksToColumnInMemory(
            tasks,
            columns,
            ["incoming"],
            "c",
            displayed
        );

        expect(
            result?.tasks
                .filter((entry) => entry.status === "todo")
                .map((entry) => entry.id)
        ).toEqual(["a", "hidden", "incoming", "c"]);
    });
});
