import { describe, expect, it } from "vitest";

import { planTaskNotificationEvents } from "./plan-task-notification-events";

describe("planTaskNotificationEvents", () => {
    it("fans out status_change to Watchers for a same-Board column move", () => {
        expect(
            planTaskNotificationEvents({
                status: {
                    from: { id: "todo", name: "Todo" },
                    to: { id: "doing", name: "Doing" },
                },
            })
        ).toEqual([
            {
                kind: "status_change",
                metadata: {
                    from: { id: "todo", name: "Todo" },
                    to: { id: "doing", name: "Doing" },
                },
            },
        ]);
    });

    it("emits board_move only when Board move remaps status (no status_change)", () => {
        expect(
            planTaskNotificationEvents({
                boardMove: {
                    fromBoard: { id: "b1", name: "Core" },
                    fromStatus: { id: "todo", name: "Todo" },
                    toBoard: { id: "b2", name: "Frontend" },
                    toStatus: { id: "backlog", name: "Backlog" },
                },
                status: {
                    from: { id: "todo", name: "Todo" },
                    to: { id: "backlog", name: "Backlog" },
                },
            })
        ).toEqual([
            {
                kind: "board_move",
                metadata: {
                    fromBoard: { id: "b1", name: "Core" },
                    fromStatus: { id: "todo", name: "Todo" },
                    toBoard: { id: "b2", name: "Frontend" },
                    toStatus: { id: "backlog", name: "Backlog" },
                },
            },
        ]);
    });

    it("fans out priority_change to Watchers", () => {
        expect(
            planTaskNotificationEvents({
                priority: { from: "medium", to: "urgent" },
            })
        ).toEqual([
            {
                kind: "priority_change",
                metadata: { from: "medium", to: "urgent" },
            },
        ]);
    });

    it("emits always-on assignment plus Watcher assignee_change when Assignee is set", () => {
        expect(
            planTaskNotificationEvents({
                assignee: {
                    from: undefined,
                    to: { id: "u2", name: "Alex" },
                },
            })
        ).toEqual([
            {
                kind: "assignment",
                metadata: {
                    assignee: { id: "u2", name: "Alex" },
                    previousAssignee: undefined,
                },
                recipientId: "u2",
            },
            {
                kind: "assignee_change",
                metadata: {
                    assignee: { id: "u2", name: "Alex" },
                    previousAssignee: undefined,
                },
            },
        ]);
    });

    it("emits nothing when Assignee is cleared", () => {
        expect(
            planTaskNotificationEvents({
                assignee: {
                    from: { id: "u2", name: "Alex" },
                    to: undefined,
                },
            })
        ).toEqual([]);
    });

    it("emits always-on and Watcher author_change when Author is transferred", () => {
        expect(
            planTaskNotificationEvents({
                author: {
                    from: { id: "u1", name: "Sam" },
                    to: { id: "u3", name: "Riley" },
                },
            })
        ).toEqual([
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: { id: "u1", name: "Sam" },
                },
                recipientId: "u3",
            },
            {
                kind: "author_change",
                metadata: {
                    author: { id: "u3", name: "Riley" },
                    previousAuthor: { id: "u1", name: "Sam" },
                },
            },
        ]);
    });

    it("emits one event per changed kind on a multi-field save", () => {
        const events = planTaskNotificationEvents({
            assignee: {
                from: { id: "u2", name: "Alex" },
                to: { id: "u4", name: "Jordan" },
            },
            author: {
                from: { id: "u1", name: "Sam" },
                to: { id: "u3", name: "Riley" },
            },
            priority: { from: "low", to: "high" },
            status: {
                from: { id: "todo", name: "Todo" },
                to: { id: "doing", name: "Doing" },
            },
        });

        expect(events.map((event) => event.kind)).toEqual([
            "status_change",
            "priority_change",
            "assignment",
            "assignee_change",
            "author_change",
            "author_change",
        ]);
    });
});
