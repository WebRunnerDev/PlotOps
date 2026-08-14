import { describe, expect, it } from "vitest";

import { planSubtaskChangeNotification } from "./plan-subtask-change-notification";

describe("planSubtaskChangeNotification", () => {
    it("plans Watcher subtask_change on the Parent when a Subtask is created", () => {
        expect(
            planSubtaskChangeNotification({
                action: "created",
                parentId: "parent-1",
                subtaskKey: "TASK-20",
            })
        ).toEqual({
            kind: "subtask_change",
            metadata: {
                action: "created",
                source: "app",
                subtaskKey: "TASK-20",
            },
        });
    });

    it("plans Watcher subtask_change on the Parent when a Subtask enters Done", () => {
        expect(
            planSubtaskChangeNotification({
                action: "closed",
                fromDone: false,
                parentId: "parent-1",
                subtaskKey: "TASK-21",
                toDone: true,
            })
        ).toEqual({
            kind: "subtask_change",
            metadata: {
                action: "closed",
                source: "app",
                subtaskKey: "TASK-21",
            },
        });
    });

    it("plans nothing for a root Task", () => {
        expect(
            planSubtaskChangeNotification({
                action: "created",
                subtaskKey: "TASK-1",
            })
        ).toBeUndefined();
        expect(
            planSubtaskChangeNotification({
                action: "closed",
                fromDone: false,
                subtaskKey: "TASK-1",
                toDone: true,
            })
        ).toBeUndefined();
    });

    it("plans nothing when a Subtask does not newly enter Done", () => {
        expect(
            planSubtaskChangeNotification({
                action: "closed",
                fromDone: false,
                parentId: "parent-1",
                subtaskKey: "TASK-20",
                toDone: false,
            })
        ).toBeUndefined();
        expect(
            planSubtaskChangeNotification({
                action: "closed",
                fromDone: true,
                parentId: "parent-1",
                subtaskKey: "TASK-21",
                toDone: true,
            })
        ).toBeUndefined();
    });
});
