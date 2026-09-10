import { describe, expect, it } from "vitest";

import {
    type CreateTaskSprintResolution,
    resolveCreateTaskSprint,
} from "./resolve-create-task-sprint-id";

describe("resolveCreateTaskSprint", () => {
    it("assigns the sole selected Active when board scope is active", () => {
        expect(
            resolveCreateTaskSprint({
                boardSprintScope: "active",
                selectedActiveSprintIds: ["sprint-a"],
            })
        ).toEqual({
            mode: "sprint",
            sprintId: "sprint-a",
        } satisfies CreateTaskSprintResolution);
    });

    it("requires a picker when multiple Actives are selected", () => {
        expect(
            resolveCreateTaskSprint({
                boardSprintScope: "active",
                selectedActiveSprintIds: ["sprint-a", "sprint-b"],
            })
        ).toEqual({
            mode: "pick",
            sprintIds: ["sprint-a", "sprint-b"],
        } satisfies CreateTaskSprintResolution);
    });

    it("leaves backlog when viewing the entire board", () => {
        expect(
            resolveCreateTaskSprint({
                boardSprintScope: "entire",
                selectedActiveSprintIds: ["sprint-a"],
            })
        ).toEqual({ mode: "backlog" } satisfies CreateTaskSprintResolution);
    });

    it("leaves backlog when active scope has no selected Active", () => {
        expect(
            resolveCreateTaskSprint({
                boardSprintScope: "active",
                selectedActiveSprintIds: [],
            })
        ).toEqual({ mode: "backlog" } satisfies CreateTaskSprintResolution);
    });
});

describe("active sprint create visibility", () => {
    it("keeps a newly created task visible under a single-Active filter", () => {
        const resolution = resolveCreateTaskSprint({
            boardSprintScope: "active",
            selectedActiveSprintIds: ["sprint-a"],
        });
        expect(resolution.mode).toBe("sprint");
        if (resolution.mode !== "sprint") return;

        const created = { id: "t1", sprintId: resolution.sprintId };
        const visible = [created].filter(
            (task) => task.sprintId === "sprint-a"
        );

        expect(visible).toHaveLength(1);
    });
});
