import { describe, expect, it } from "vitest";

import { planAssigneeChangeNotifications } from "./plan-assignee-change-notifications";

describe("planAssigneeChangeNotifications", () => {
    it("plans always-on assignment plus Watcher assignee_change when Assignee is set", () => {
        expect(
            planAssigneeChangeNotifications([
                {
                    field: "assignee",
                    from: null,
                    to: { id: "u2", name: "Alex" },
                },
            ])
        ).toEqual([
            {
                kind: "assignment",
                metadata: {
                    assignee: { id: "u2", name: "Alex" },
                    previousAssignee: null,
                    source: "app",
                },
                recipientId: "u2",
            },
            {
                kind: "assignee_change",
                metadata: {
                    assignee: { id: "u2", name: "Alex" },
                    previousAssignee: null,
                    source: "app",
                },
            },
        ]);
    });

    it("plans both kinds when Assignee is reassigned", () => {
        expect(
            planAssigneeChangeNotifications([
                {
                    field: "assignee",
                    from: { id: "u2", name: "Alex" },
                    to: { id: "u4", name: "Jordan" },
                },
            ])
        ).toEqual([
            {
                kind: "assignment",
                metadata: {
                    assignee: { id: "u4", name: "Jordan" },
                    previousAssignee: { id: "u2", name: "Alex" },
                    source: "app",
                },
                recipientId: "u4",
            },
            {
                kind: "assignee_change",
                metadata: {
                    assignee: { id: "u4", name: "Jordan" },
                    previousAssignee: { id: "u2", name: "Alex" },
                    source: "app",
                },
            },
        ]);
    });

    it("plans nothing when Assignee is cleared", () => {
        expect(
            planAssigneeChangeNotifications([
                {
                    field: "assignee",
                    from: { id: "u2", name: "Alex" },
                    to: null,
                },
            ])
        ).toEqual([]);
    });

    it("plans nothing when Assignee did not change", () => {
        expect(
            planAssigneeChangeNotifications([
                { field: "title", from: "A", to: "B" },
                {
                    field: "priority",
                    from: "low",
                    to: "high",
                },
            ])
        ).toEqual([]);
    });
});
