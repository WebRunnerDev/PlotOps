import { describe, expect, it } from "vitest";

import { filterLiveBoardTasks } from "./filter-live-board-tasks";

describe("filterLiveBoardTasks", () => {
    const sprints = [
        { id: "active-1", state: "active" as const },
        { id: "closed-1", state: "closed" as const },
        { id: "draft-1", state: "draft" as const },
    ];

    const tasks = [
        { id: "t-backlog", sprintId: undefined },
        { id: "t-active", sprintId: "active-1" },
        { id: "t-closed", sprintId: "closed-1" },
        { id: "t-draft", sprintId: "draft-1" },
    ];

    it("for Entire board, hides Closed Sprint members but keeps Backlog and Draft/Active", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintId: "active-1",
                scope: "entire",
                sprints,
                tasks,
            }).map((task) => task.id)
        ).toEqual(["t-backlog", "t-active", "t-draft"]);
    });

    it("for Active Sprint scope, keeps only Active members", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintId: "active-1",
                scope: "active",
                sprints,
                tasks,
            }).map((task) => task.id)
        ).toEqual(["t-active"]);
    });
});
