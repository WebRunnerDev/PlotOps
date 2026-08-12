import { describe, expect, it } from "vitest";

import type { Task } from "@/features/tasks";

import {
    applySprintMembershipUpdates,
    planSprintMembershipMove,
} from "./plan-sprint-membership-move";

function task(overrides: Partial<Task> & Pick<Task, "id">): Task {
    return {
        boardId: "board-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        key: overrides.id.toUpperCase(),
        status: "todo",
        title: overrides.id,
        type: "task",
        ...overrides,
    };
}

describe("planSprintMembershipMove", () => {
    it("appends moved tasks after existing target siblings", () => {
        const tasks = [
            task({ id: "a", sprintId: "s1", sprintPosition: 0 }),
            task({ id: "b" }),
            task({ id: "c", sprintId: "s1", sprintPosition: 2 }),
        ];

        expect(
            planSprintMembershipMove({
                targetSprintId: "s1",
                taskIds: ["b"],
                tasks,
            })
        ).toEqual([{ sprintId: "s1", sprintPosition: 3, taskId: "b" }]);
    });

    it("skips tasks already in the target container", () => {
        const tasks = [
            task({ id: "a", sprintId: "s1", sprintPosition: 0 }),
            task({ id: "b", sprintId: "s1", sprintPosition: 1 }),
        ];

        expect(
            planSprintMembershipMove({
                targetSprintId: "s1",
                taskIds: ["a", "b"],
                tasks,
            })
        ).toEqual([]);
    });

    it("assigns backlog positions when targetSprintId is null", () => {
        const tasks = [
            task({ id: "a", sprintPosition: 1 }),
            task({ id: "b", sprintId: "s1", sprintPosition: 0 }),
        ];

        expect(
            planSprintMembershipMove({
                targetSprintId: null,
                taskIds: ["b"],
                tasks,
            })
        ).toEqual([{ sprintId: null, sprintPosition: 2, taskId: "b" }]);
    });

    it("reads the same max position from a stale snapshot (race precondition)", () => {
        const tasks = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })];

        const first = planSprintMembershipMove({
            targetSprintId: "s1",
            taskIds: ["b"],
            tasks,
        });
        const second = planSprintMembershipMove({
            targetSprintId: "s1",
            taskIds: ["c"],
            tasks,
        });

        expect(first[0]?.sprintPosition).toBe(0);
        expect(second[0]?.sprintPosition).toBe(0);
    });
});

describe("applySprintMembershipUpdates", () => {
    it("reflects a prior move so the next plan appends at the end", () => {
        const tasks = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })];

        const first = planSprintMembershipMove({
            targetSprintId: "s1",
            taskIds: ["b"],
            tasks,
        });
        const afterFirst = applySprintMembershipUpdates(tasks, first);

        const second = planSprintMembershipMove({
            targetSprintId: "s1",
            taskIds: ["c"],
            tasks: afterFirst,
        });

        expect(second).toEqual([
            { sprintId: "s1", sprintPosition: 1, taskId: "c" },
        ]);
    });

    it("clears sprint fields when moving to backlog with null position", () => {
        const tasks = [task({ id: "a", sprintId: "s1", sprintPosition: 0 })];

        const next = applySprintMembershipUpdates(tasks, [
            { sprintId: null, sprintPosition: null, taskId: "a" },
        ]);

        expect(next[0]?.sprintId).toBeUndefined();
        expect(next[0]?.sprintPosition).toBeUndefined();
    });
});
