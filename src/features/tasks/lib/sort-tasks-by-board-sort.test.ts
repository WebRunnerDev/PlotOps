import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import {
    DEFAULT_BOARD_SORT,
    sortTasksByBoardSort,
} from "./sort-tasks-by-board-sort";

function task(id: string, overrides: Partial<Task> = {}): Task {
    return {
        boardId: "board",
        createdAt: "2026-01-01T00:00:00.000Z",
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

    it("sorts Deadline ascending (soon → far)", () => {
        const tasks = [
            task("far", { deadline: "2026-12-01", title: "Far" }),
            task("soon", { deadline: "2026-03-01", title: "Soon" }),
            task("mid", { deadline: "2026-06-15", title: "Mid" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "deadline",
            }).map((item) => item.id)
        ).toEqual(["soon", "mid", "far"]);
    });

    it("sorts Deadline descending (far → soon)", () => {
        const tasks = [
            task("soon", { deadline: "2026-03-01", title: "Soon" }),
            task("far", { deadline: "2026-12-01", title: "Far" }),
            task("mid", { deadline: "2026-06-15", title: "Mid" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "deadline",
            }).map((item) => item.id)
        ).toEqual(["far", "mid", "soon"]);
    });

    it("places Tasks with no Deadline last for either Deadline direction", () => {
        const tasks = [
            task("none-a", { title: "None A" }),
            task("soon", { deadline: "2026-03-01", title: "Soon" }),
            task("none-b", { title: "None B" }),
            task("far", { deadline: "2026-12-01", title: "Far" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "deadline",
            }).map((item) => item.id)
        ).toEqual(["soon", "far", "none-a", "none-b"]);

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "deadline",
            }).map((item) => item.id)
        ).toEqual(["far", "soon", "none-a", "none-b"]);
    });

    it("breaks Deadline ties by Title A→Z then Manual order", () => {
        const tasks = [
            task("zebra-second", { deadline: "2026-06-01", title: "Zebra" }),
            task("alpha", { deadline: "2026-06-01", title: "Alpha" }),
            task("zebra-first", { deadline: "2026-06-01", title: "Zebra" }),
            task("beta", { deadline: "2026-06-01", title: "Beta" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "deadline",
            }).map((item) => item.id)
        ).toEqual(["alpha", "beta", "zebra-second", "zebra-first"]);
    });

    it("sorts Title ascending (A→Z)", () => {
        const tasks = [
            task("c", { title: "Charlie" }),
            task("a", { title: "Alpha" }),
            task("b", { title: "Bravo" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "title",
            }).map((item) => item.id)
        ).toEqual(["a", "b", "c"]);
    });

    it("sorts Title descending (Z→A)", () => {
        const tasks = [
            task("a", { title: "Alpha" }),
            task("c", { title: "Charlie" }),
            task("b", { title: "Bravo" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "title",
            }).map((item) => item.id)
        ).toEqual(["c", "b", "a"]);
    });

    it("breaks Title ties by Manual order", () => {
        const tasks = [
            task("second", { title: "Same" }),
            task("first", { title: "Same" }),
            task("third", { title: "Same" }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "title",
            }).map((item) => item.id)
        ).toEqual(["second", "first", "third"]);

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "title",
            }).map((item) => item.id)
        ).toEqual(["second", "first", "third"]);
    });

    it("sorts Created ascending (oldest → newest)", () => {
        const tasks = [
            task("new", {
                createdAt: "2026-08-04T12:00:00.000Z",
                title: "New",
            }),
            task("old", {
                createdAt: "2026-07-01T12:00:00.000Z",
                title: "Old",
            }),
            task("mid", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Mid",
            }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "created",
            }).map((item) => item.id)
        ).toEqual(["old", "mid", "new"]);
    });

    it("sorts Created descending (newest → oldest)", () => {
        const tasks = [
            task("old", {
                createdAt: "2026-07-01T12:00:00.000Z",
                title: "Old",
            }),
            task("new", {
                createdAt: "2026-08-04T12:00:00.000Z",
                title: "New",
            }),
            task("mid", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Mid",
            }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "desc",
                field: "created",
            }).map((item) => item.id)
        ).toEqual(["new", "mid", "old"]);
    });

    it("breaks Created ties by Title A→Z then Manual order", () => {
        const tasks = [
            task("zebra-second", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Zebra",
            }),
            task("alpha", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Alpha",
            }),
            task("zebra-first", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Zebra",
            }),
            task("beta", {
                createdAt: "2026-07-15T12:00:00.000Z",
                title: "Beta",
            }),
        ];

        expect(
            sortTasksByBoardSort(tasks, {
                direction: "asc",
                field: "created",
            }).map((item) => item.id)
        ).toEqual(["alpha", "beta", "zebra-second", "zebra-first"]);
    });
});
