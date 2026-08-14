import { describe, expect, it } from "vitest";

import { resolveRestoreSubtaskSprintId } from "./resolve-restore-subtask-sprint";

describe("resolveRestoreSubtaskSprintId", () => {
    it("rejoins the Parent Task's live Sprint", () => {
        expect(
            resolveRestoreSubtaskSprintId({
                parentId: "parent",
                parentSprintId: "sprint-a",
                parentSprintIsLive: true,
            })
        ).toBe("sprint-a");
    });

    it("stays in Backlog when the Parent Task has no live Sprint", () => {
        expect(
            resolveRestoreSubtaskSprintId({
                parentId: "parent",
                parentSprintId: "closed",
                parentSprintIsLive: false,
            })
        ).toBeUndefined();
        expect(
            resolveRestoreSubtaskSprintId({
                parentId: "parent",
                parentSprintIsLive: true,
            })
        ).toBeUndefined();
    });

    it("does not assign a Sprint to a restored root Task", () => {
        expect(
            resolveRestoreSubtaskSprintId({
                parentSprintId: "sprint-a",
                parentSprintIsLive: true,
            })
        ).toBeUndefined();
    });
});
