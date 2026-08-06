import { describe, expect, it } from "vitest";

import { resolveCreateTaskSprintId } from "./resolve-create-task-sprint-id";

describe("resolveCreateTaskSprintId", () => {
    it("assigns the active sprint when board scope is active", () => {
        expect(
            resolveCreateTaskSprintId({
                activeSprintId: "sprint-a",
                boardSprintScope: "active",
            })
        ).toBe("sprint-a");
    });

    it("leaves backlog when viewing the entire board", () => {
        expect(
            resolveCreateTaskSprintId({
                activeSprintId: "sprint-a",
                boardSprintScope: "entire",
            })
        ).toBeUndefined();
    });

    it("leaves backlog when active scope has no active sprint", () => {
        expect(
            resolveCreateTaskSprintId({
                activeSprintId: undefined,
                boardSprintScope: "active",
            })
        ).toBeUndefined();
    });
});

describe("active sprint create visibility", () => {
    it("keeps a newly created task visible under active board scope", () => {
        const activeSprintId = "sprint-a";
        const sprintId = resolveCreateTaskSprintId({
            activeSprintId,
            boardSprintScope: "active",
        });
        const created = { id: "t1", sprintId };
        const visible = [created].filter(
            (task) => task.sprintId === activeSprintId
        );

        // Regression: omitting sprintId (Backlog) hides the card until the user
        // switches board scope to "entire".
        expect(visible).toHaveLength(1);
    });
});
