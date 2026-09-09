import { describe, expect, it } from "vitest";

import { planTitleWatcherNotification } from "./plan-title-watcher-notification";

describe("planTitleWatcherNotification", () => {
    it("plans title_change for Watchers when Title changes", () => {
        expect(
            planTitleWatcherNotification([
                { field: "title", from: "Old title", to: "New title" },
            ])
        ).toEqual({
            kind: "title_change",
            metadata: {
                from: "Old title",
                source: "app",
                to: "New title",
            },
        });
    });

    it("plans nothing when Title did not change", () => {
        expect(
            planTitleWatcherNotification([
                { field: "priority", from: "medium", to: "urgent" },
                {
                    field: "status",
                    from: { id: "todo", name: "Todo" },
                    to: { id: "doing", name: "Doing" },
                },
            ])
        ).toBeUndefined();
    });

    it("plans nothing when Title from and to are identical", () => {
        expect(
            planTitleWatcherNotification([
                { field: "title", from: "Same", to: "Same" },
            ])
        ).toBeUndefined();
    });
});
