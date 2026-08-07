import { describe, expect, it } from "vitest";

import { suggestedCompletedTaskIds } from "./suggested-completed-task-ids";

describe("suggestedCompletedTaskIds", () => {
    it("suggests tasks in Done columns even when not rightmost", () => {
        const result = suggestedCompletedTaskIds({
            columns: [
                { id: "todo", isDone: false },
                { id: "done", isDone: true },
                { id: "released", isDone: false },
            ],
            tasks: [
                { id: "t1", status: "todo" },
                { id: "t2", status: "done" },
                { id: "t3", status: "released" },
            ],
        });

        expect([...result]).toEqual(["t2"]);
    });

    it("falls back to the rightmost column when no Done is marked", () => {
        const result = suggestedCompletedTaskIds({
            columns: [
                { id: "todo", isDone: false },
                { id: "done", isDone: false },
            ],
            tasks: [
                { id: "t1", status: "todo" },
                { id: "t2", status: "done" },
            ],
        });

        expect([...result]).toEqual(["t2"]);
    });
});
