import { describe, expect, it } from "vitest";

import { resolveRestoreTaskStatus } from "./resolve-restore-task-status";

describe("resolveRestoreTaskStatus", () => {
    it("keeps status when the column still exists", () => {
        expect(
            resolveRestoreTaskStatus("in_progress", ["todo", "in_progress"])
        ).toBe("in_progress");
    });

    it("falls back to the first column when status was deleted", () => {
        expect(resolveRestoreTaskStatus("gone", ["todo", "done"])).toBe("todo");
    });

    it("throws when the board has no columns", () => {
        expect(() => resolveRestoreTaskStatus("gone", [])).toThrow(
            /no columns/i
        );
    });
});
