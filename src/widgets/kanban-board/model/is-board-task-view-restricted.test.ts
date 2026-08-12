import { describe, expect, it } from "vitest";

import { isBoardTaskViewRestricted } from "./is-board-task-view-restricted";

describe("isBoardTaskViewRestricted", () => {
    it("is false when every task is displayed", () => {
        const tasks = [{ id: "a" }, { id: "b" }];
        expect(isBoardTaskViewRestricted(tasks, tasks)).toBe(false);
    });

    it("is true when filters or sprint scope hide tasks", () => {
        const tasks = [{ id: "a" }, { id: "b" }, { id: "c" }];
        expect(
            isBoardTaskViewRestricted(tasks, [{ id: "a" }, { id: "c" }])
        ).toBe(true);
    });
});
