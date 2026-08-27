import { describe, expect, it } from "vitest";

import {
    doneColumnIdSet,
    hideCompletedBoardTasks,
} from "./board-completed-visibility";

describe("hideCompletedBoardTasks", () => {
    const doneColumnIds = new Set(["done"]);

    const tasks = [
        { id: "open", status: "todo" },
        { id: "finished", status: "done" },
    ];

    it("returns all tasks when hide is off", () => {
        expect(hideCompletedBoardTasks(tasks, doneColumnIds, false)).toEqual(
            tasks
        );
    });

    it("drops tasks in Done columns when hide is on", () => {
        expect(
            hideCompletedBoardTasks(tasks, doneColumnIds, true).map(
                (task) => task.id
            )
        ).toEqual(["open"]);
    });

    it("is a no-op when no Done column is configured", () => {
        expect(hideCompletedBoardTasks(tasks, new Set(), true)).toEqual(tasks);
    });
});

describe("doneColumnIdSet", () => {
    it("collects ids of columns marked Done", () => {
        expect(
            doneColumnIdSet([
                { id: "todo", isDone: false },
                { id: "done", isDone: true },
                { id: "released", isDone: true },
            ])
        ).toEqual(new Set(["done", "released"]));
    });
});
