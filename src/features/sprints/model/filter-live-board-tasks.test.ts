import { describe, expect, it } from "vitest";

import { filterLiveBoardTasks } from "./filter-live-board-tasks";

describe("filterLiveBoardTasks", () => {
    const sprints = [
        { id: "active-1", state: "active" as const },
        { id: "active-2", state: "active" as const },
        { id: "closed-1", state: "closed" as const },
        { id: "draft-1", state: "draft" as const },
    ];

    const tasks = [
        { id: "t-backlog", sprintId: undefined },
        { id: "t-active-1", sprintId: "active-1" },
        { id: "t-active-2", sprintId: "active-2" },
        { id: "t-closed", sprintId: "closed-1" },
        { id: "t-draft", sprintId: "draft-1" },
    ];

    it("for Entire board, hides Closed Sprint members but keeps Backlog and Draft/Active", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintIds: ["active-1", "active-2"],
                scope: "entire",
                sprints,
                tasks,
            }).map((task) => task.id)
        ).toEqual(["t-backlog", "t-active-1", "t-active-2", "t-draft"]);
    });

    it("for Active scope, keeps the union of selected Active members", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintIds: ["active-1", "active-2"],
                scope: "active",
                sprints,
                tasks,
            }).map((task) => task.id)
        ).toEqual(["t-active-1", "t-active-2"]);
    });

    it("for Active scope, narrows to the selected Active subset", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintIds: ["active-2"],
                scope: "active",
                sprints,
                tasks,
            }).map((task) => task.id)
        ).toEqual(["t-active-2"]);
    });

    it("for Active scope with no selected Actives, shows an empty board", () => {
        expect(
            filterLiveBoardTasks({
                activeSprintIds: [],
                scope: "active",
                sprints,
                tasks,
            })
        ).toEqual([]);
    });
});
