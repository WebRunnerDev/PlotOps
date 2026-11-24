import { describe, expect, it } from "vitest";

import { cloneGuestDemoSeed } from "./guest-demo-seed";
import {
    recordGuestStatusChanges,
    withGuestDemoStatusHistory,
} from "./guest-status-history";

const NOW = new Date(2026, 10, 24, 15, 0, 0);

describe("recordGuestStatusChanges", () => {
    it("records column moves and creations, not other edits", () => {
        const previous = cloneGuestDemoSeed();
        previous.statusChanges = [];
        const next = structuredClone(previous);
        const moved = next.tasks.find(
            (task) => task.status === "todo" && task.type !== "epic"
        )!;
        moved.status = "in_progress";
        next.tasks.find((task) => task.id !== moved.id)!.title = "Renamed";
        next.tasks.push({
            ...structuredClone(moved),
            id: "new-task",
            status: "todo",
        });

        recordGuestStatusChanges(previous, next, NOW);

        expect(
            next.statusChanges?.map((change) => [
                change.taskId,
                change.fromStatus,
                change.fromStatusName,
                change.toStatus,
                change.toStatusName,
            ])
        ).toEqual([
            [moved.id, "todo", "To Do", "in_progress", "In Progress"],
            ["new-task", null, null, "todo", "To Do"],
        ]);
    });
});

describe("withGuestDemoStatusHistory", () => {
    it("ends every Task's demo history in its current column", () => {
        const sandbox = withGuestDemoStatusHistory(cloneGuestDemoSeed(), NOW);
        const changes = sandbox.statusChanges ?? [];
        expect(changes.length).toBeGreaterThan(0);

        for (const task of sandbox.tasks) {
            const own = changes.filter((change) => change.taskId === task.id);
            if (own.length === 0) continue;
            expect(own.at(-1)?.toStatus).toBe(task.status);
            expect(Date.parse(own[0]!.changedAt)).toBeGreaterThanOrEqual(
                Date.parse(task.createdAt)
            );
            expect(Date.parse(own.at(-1)!.changedAt)).toBeLessThan(
                NOW.getTime()
            );
        }
    });

    it("is stable through the day", () => {
        const morning = withGuestDemoStatusHistory(
            cloneGuestDemoSeed(),
            new Date(2026, 10, 24, 8, 0, 0)
        );
        const evening = withGuestDemoStatusHistory(
            cloneGuestDemoSeed(),
            new Date(2026, 10, 24, 22, 0, 0)
        );
        expect(evening).toEqual(morning);
    });
});
