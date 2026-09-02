import { describe, expect, it } from "vitest";

import {
    filterTasksBySearchQuery,
    matchesTaskSearchQuery,
} from "./search-tasks";

describe("matchesTaskSearchQuery", () => {
    const task = { key: "TASK-12", title: "Login page" };

    it("matches empty query", () => {
        expect(matchesTaskSearchQuery(task, "")).toBe(true);
        expect(matchesTaskSearchQuery(task, "   ")).toBe(true);
    });

    it("matches key and title", () => {
        expect(matchesTaskSearchQuery(task, "task-12")).toBe(true);
        expect(matchesTaskSearchQuery(task, "login")).toBe(true);
        expect(matchesTaskSearchQuery(task, "missing")).toBe(false);
    });

    it("matches extra haystack (board name)", () => {
        expect(matchesTaskSearchQuery(task, "kanban", ["Main board"])).toBe(
            false
        );
        expect(matchesTaskSearchQuery(task, "main", ["Main board"])).toBe(true);
    });
});

describe("filterTasksBySearchQuery", () => {
    const tasks = [
        { key: "TASK-1", title: "Alpha" },
        { key: "TASK-2", title: "Beta" },
    ];

    it("returns all tasks for empty query", () => {
        expect(filterTasksBySearchQuery(tasks, "")).toEqual(tasks);
        expect(filterTasksBySearchQuery(tasks, "   ")).toEqual(tasks);
    });

    it("filters by key or title", () => {
        expect(filterTasksBySearchQuery(tasks, "task-2")).toEqual([tasks[1]]);
        expect(filterTasksBySearchQuery(tasks, "alpha")).toEqual([tasks[0]]);
    });
});
