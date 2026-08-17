import { describe, expect, it } from "vitest";

import { matchesTaskSearchQuery } from "./search-tasks";

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
