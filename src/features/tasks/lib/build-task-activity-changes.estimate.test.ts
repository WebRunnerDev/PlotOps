import { describe, expect, it } from "vitest";

import {
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

describe("task activity seam — estimate field", () => {
    it("logs estimate changes including clear to unestimated", () => {
        const changes = buildTaskActivityChanges(
            snapshot({ estimate: 3 }),
            snapshot({ estimate: 8 })
        );
        expect(changes).toEqual([{ field: "estimate", from: 3, to: 8 }]);

        const cleared = buildTaskActivityChanges(
            snapshot({ estimate: 5 }),
            snapshot({ estimate: null })
        );
        expect(cleared).toEqual([{ field: "estimate", from: 5, to: null }]);
    });

    it("omits estimate when unchanged", () => {
        const changes = buildTaskActivityChanges(
            snapshot({ estimate: 5, title: "A" }),
            snapshot({ estimate: 5, title: "B" })
        );
        expect(changes.map((change) => change.field)).toEqual(["title"]);
    });
});
