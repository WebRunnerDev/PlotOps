import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks/model/types";

import {
    EMPTY_BOARD_FILTERS,
    filterTasks,
    isBoardFiltersActive,
    UNASSIGNED_ASSIGNEE_FILTER,
} from "./filter-tasks";

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

describe("filterTasks assignees", () => {
    const alice = { id: "alice", name: "Alice" };
    const bob = { id: "bob", name: "Bob" };

    const tasks = [
        task("unassigned"),
        task("a", { assignee: alice }),
        task("b", { assignee: bob }),
    ];

    it("is inactive when assigneeIds is empty", () => {
        expect(isBoardFiltersActive(EMPTY_BOARD_FILTERS)).toBe(false);
        expect(filterTasks(tasks, EMPTY_BOARD_FILTERS)).toEqual(tasks);
    });

    it("matches unassigned tasks", () => {
        expect(
            filterTasks(tasks, {
                ...EMPTY_BOARD_FILTERS,
                assigneeIds: [UNASSIGNED_ASSIGNEE_FILTER],
            }).map((item) => item.id)
        ).toEqual(["unassigned"]);
    });

    it("matches selected assignees (OR within group)", () => {
        expect(
            filterTasks(tasks, {
                ...EMPTY_BOARD_FILTERS,
                assigneeIds: [alice.id, bob.id],
            }).map((item) => item.id)
        ).toEqual(["a", "b"]);
    });

    it("matches unassigned together with a person", () => {
        expect(
            filterTasks(tasks, {
                ...EMPTY_BOARD_FILTERS,
                assigneeIds: [UNASSIGNED_ASSIGNEE_FILTER, alice.id],
            }).map((item) => item.id)
        ).toEqual(["unassigned", "a"]);
    });

    it("ANDs assignee with priority filters", () => {
        const mixed = [
            task("a-urgent", { assignee: alice, priority: "urgent" }),
            task("a-low", { assignee: alice, priority: "low" }),
            task("b-urgent", { assignee: bob, priority: "urgent" }),
        ];

        expect(
            filterTasks(mixed, {
                ...EMPTY_BOARD_FILTERS,
                assigneeIds: [alice.id],
                priorities: ["urgent"],
            }).map((item) => item.id)
        ).toEqual(["a-urgent"]);
    });
});

describe("filterTasks boards", () => {
    const tasks = [
        task("a", { boardId: "board-a" }),
        task("b", { boardId: "board-b" }),
        task("c", { boardId: "board-c" }),
    ];

    it("is inactive when boardIds is empty", () => {
        expect(
            filterTasks(tasks, {
                ...EMPTY_BOARD_FILTERS,
                boardIds: [],
            })
        ).toEqual(tasks);
    });

    it("matches selected boards (OR within group)", () => {
        expect(
            filterTasks(tasks, {
                ...EMPTY_BOARD_FILTERS,
                boardIds: ["board-a", "board-c"],
            }).map((item) => item.id)
        ).toEqual(["a", "c"]);
    });

    it("ANDs board with assignee filters", () => {
        const alice = { id: "alice", name: "Alice" };
        const mixed = [
            task("a", { assignee: alice, boardId: "board-a" }),
            task("b", { assignee: alice, boardId: "board-b" }),
            task("c", { boardId: "board-a" }),
        ];

        expect(
            filterTasks(mixed, {
                ...EMPTY_BOARD_FILTERS,
                assigneeIds: [alice.id],
                boardIds: ["board-a"],
            }).map((item) => item.id)
        ).toEqual(["a"]);
    });
});
