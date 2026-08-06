import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import {
    DEFAULT_BOARD_SORT,
    sortTasksByBoardSort,
} from "./sort-tasks-by-board-sort";

function task(id: string, overrides: Partial<Task> = {}): Task {
    return {
        boardId: "board",
        id,
        key: id,
        status: "todo",
        title: id,
        type: "task",
        ...overrides,
    };
}

describe("sortTasksByBoardSort", () => {
    it("keeps Manual order when Board sort is Manual", () => {
        const tasks = [
            task("c", { priority: "low", title: "Charlie" }),
            task("a", { priority: "urgent", title: "Alpha" }),
            task("b", { priority: "high", title: "Bravo" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, DEFAULT_BOARD_SORT).map(
                (item) => item.id
            )
        ).toEqual(["c", "a", "b"]);
    });

    it("sorts Priority descending (urgent → low) without mutating input", () => {
        const tasks = [
            task("low", { priority: "low", title: "Low" }),
            task("urgent", { priority: "urgent", title: "Urgent" }),
            task("medium", { priority: "medium", title: "Medium" }),
            task("high", { priority: "high", title: "High" }),
        ];

        const sorted = sortTasksByBoardSort(tasks, {
            direction: "desc",
            field: "priority",
        });

        expect(sorted.map((item) => item.id)).toEqual([
            "urgent",
            "high",
            "medium",
            "low",
        ]);
        expect(tasks.map((item) => item.id)).toEqual([
            "low",
            "urgent",
            "medium",
            "high",
        ]);
    });

    it("sorts Priority ascending (low → urgent)", () => {
        const tasks = [
            task("urgent", { priority: "urgent", title: "Urgent" }),
            task("low", { priority: "low", title: "Low" }),
            task("high", { priority: "high", title: "High" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "priority",
            }).map((item) => item.id)
        ).toEqual(["low", "high", "urgent"]);
    });

    it("places Tasks with no Priority last for either Priority direction", () => {
        const tasks = [
            task("none-a", { title: "None A" }),
            task("high", { priority: "high", title: "High" }),
            task("none-b", { title: "None B" }),
            task("low", { priority: "low", title: "Low" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "priority",
            }).map((item) => item.id)
        ).toEqual(["high", "low", "none-a", "none-b"]);

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "priority",
            }).map((item) => item.id)
        ).toEqual(["low", "high", "none-a", "none-b"]);
    });

    it("breaks Priority ties by Title A→Z then Manual order", () => {
        const tasks = [
            task("zebra-second", { priority: "high", title: "Zebra" }),
            task("alpha", { priority: "high", title: "Alpha" }),
            task("zebra-first", { priority: "high", title: "Zebra" }),
            task("beta", { priority: "high", title: "Beta" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "priority",
            }).map((item) => item.id)
        ).toEqual(["alpha", "beta", "zebra-second", "zebra-first"]);
    });
});
