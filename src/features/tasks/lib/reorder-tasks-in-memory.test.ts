import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import { reorderTasksInMemory } from "./reorder-tasks-in-memory";

function task(
    id: string,
    status: Task["status"],
    overrides: Partial<Task> = {}
): Task {
    return {
        boardId: "board",
        id,
        key: id,
        status,
        title: id,
        type: "task",
        ...overrides,
    };
}

describe("reorderTasksInMemory", () => {
    it("reorders within a column without jumping to the top", () => {
        // Interleaved flat order (as after global sort-by-position).
        const tasks = [
            task("ip-a", "in_progress"),
            task("todo-a", "todo"),
            task("ip-b", "in_progress"),
            task("todo-b", "todo"),
            task("todo-c", "todo"),
            task("done-a", "done"),
            task("todo-d", "todo"),
        ];

        const result = reorderTasksInMemory(tasks, "todo-d", "todo-b");
        expect(result).toBeDefined();

        const todoOrder = result!.tasks
            .filter((item) => item.status === "todo")
            .map((item) => item.id);
        expect(todoOrder).toEqual(["todo-a", "todo-d", "todo-b", "todo-c"]);

        expect(result!.updates).toEqual([
            { id: "todo-a", position: 0, status: "todo" },
            { id: "todo-d", position: 1, status: "todo" },
            { id: "todo-b", position: 2, status: "todo" },
            { id: "todo-c", position: 3, status: "todo" },
        ]);
    });

    it("no-ops across columns", () => {
        const tasks = [task("a", "todo"), task("b", "done")];
        expect(reorderTasksInMemory(tasks, "a", "b")).toBeUndefined();
    });
});
