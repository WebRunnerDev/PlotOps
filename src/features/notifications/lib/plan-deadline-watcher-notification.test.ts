import { describe, expect, it } from "vitest";

import { planDeadlineWatcherNotification } from "./plan-deadline-watcher-notification";

describe("planDeadlineWatcherNotification", () => {
    it("plans deadline_change for Watchers when Deadline changes", () => {
        expect(
            planDeadlineWatcherNotification([
                { field: "deadline", from: "2026-07-28", to: "2026-07-30" },
            ])
        ).toEqual({
            kind: "deadline_change",
            metadata: {
                from: "2026-07-28",
                source: "app",
                to: "2026-07-30",
            },
        });
    });

    it("plans nothing when Deadline did not change", () => {
        expect(
            planDeadlineWatcherNotification([
                { field: "title", from: "A", to: "B" },
                {
                    field: "priority",
                    from: "medium",
                    to: "high",
                },
            ])
        ).toBeUndefined();
    });

    it("keeps cleared Deadline as null", () => {
        expect(
            planDeadlineWatcherNotification([
                { field: "deadline", from: "2026-07-28", to: null },
            ])
        ).toEqual({
            kind: "deadline_change",
            metadata: { from: "2026-07-28", source: "app", to: null },
        });
    });
});
