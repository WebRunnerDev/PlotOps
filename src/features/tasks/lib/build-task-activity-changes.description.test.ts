import { describe, expect, it } from "vitest";

import { planDescriptionWatcherNotification } from "@/features/notifications/lib/plan-description-watcher-notification";
import {
    applyDetailsToSnapshot,
    buildTaskActivityChanges,
    type TaskActivitySnapshot,
} from "@/features/tasks/lib/build-task-activity-changes";

function snapshot(
    overrides: Partial<TaskActivitySnapshot> = {}
): TaskActivitySnapshot {
    return {
        assignee: null,
        branchName: null,
        deadline: null,
        estimate: null,
        labelNames: [],
        pr: null,
        priority: null,
        status: { id: "todo", name: "To Do" },
        title: "Task",
        type: "task",
        ...overrides,
    };
}

describe("task activity seam — description field (BUG-174)", () => {
    it("logs a description edit without storing either body", () => {
        const before = snapshot({ description: "<p>old secret</p>" });
        const after = applyDetailsToSnapshot(before, {
            description: "<p>new secret</p>",
        });

        expect(buildTaskActivityChanges(before, after)).toEqual([
            { field: "description", from: null, to: null },
        ]);
    });

    it("logs clearing the description", () => {
        const before = snapshot({ description: "<p>text</p>" });
        const after = applyDetailsToSnapshot(before, { description: null });

        expect(buildTaskActivityChanges(before, after)).toEqual([
            { field: "description", from: null, to: null },
        ]);
    });

    it("omits description when the body is unchanged", () => {
        const before = snapshot({ description: "<p>same</p>", title: "A" });
        const after = applyDetailsToSnapshot(before, {
            description: "<p>same</p>",
            title: "B",
        });

        expect(
            buildTaskActivityChanges(before, after).map((c) => c.field)
        ).toEqual(["title"]);
    });

    it("omits description when the save does not touch it", () => {
        const before = snapshot({ title: "A" });
        const after = applyDetailsToSnapshot(before, { title: "B" });

        expect(
            buildTaskActivityChanges(before, after).map((c) => c.field)
        ).toEqual(["title"]);
    });

    it("agrees with the Watcher description_change notification", () => {
        const cases: Array<[string, null | string]> = [
            ["<p>a</p>", "<p>b</p>"],
            ["<p>a</p>", null],
            ["", "<p>first</p>"],
            ["<p>same</p>", "<p>same</p>"],
            ["", null],
        ];

        for (const [previousBody, next] of cases) {
            const before = snapshot({ description: previousBody });
            const after = applyDetailsToSnapshot(before, { description: next });
            const logged = buildTaskActivityChanges(before, after).some(
                (change) => change.field === "description"
            );
            const notified =
                planDescriptionWatcherNotification({
                    nextBody: next ?? "",
                    previousBody,
                }) !== undefined;

            expect(logged).toBe(notified);
        }
    });
});
