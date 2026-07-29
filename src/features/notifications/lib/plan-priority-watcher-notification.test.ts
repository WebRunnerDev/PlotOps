import { describe, expect, it } from "vitest";

import { planPriorityWatcherNotification } from "./plan-priority-watcher-notification";

describe("planPriorityWatcherNotification", () => {
    it("plans priority_change for Watchers when Priority changes", () => {
        expect(
            planPriorityWatcherNotification([
                { field: "priority", from: "medium", to: "urgent" },
            ])
        ).toEqual({
            kind: "priority_change",
            metadata: { from: "medium", source: "app", to: "urgent" },
        });
    });

    it("plans nothing when Priority did not change", () => {
        expect(
            planPriorityWatcherNotification([
                { field: "title", from: "A", to: "B" },
                {
                    field: "status",
                    from: { id: "todo", name: "Todo" },
                    to: { id: "doing", name: "Doing" },
                },
            ])
        ).toBeUndefined();
    });

    it("normalizes cleared Priority to none", () => {
        expect(
            planPriorityWatcherNotification([
                { field: "priority", from: "high", to: null },
            ])
        ).toEqual({
            kind: "priority_change",
            metadata: { from: "high", source: "app", to: "none" },
        });
    });
});
