import type {
    ClientRect,
    CollisionDetection,
    DroppableContainer,
} from "@dnd-kit/core";

import { describe, expect, it } from "vitest";

import { boardCollisionDetection } from "./board-collision-detection";

function container(
    id: string,
    type: "column" | "column-tasks" | "task"
): DroppableContainer {
    return {
        data: { current: { type } },
        disabled: false,
        id,
        key: id,
        node: { current: null },
        rect: { current: null },
    } as DroppableContainer;
}

function rect(
    left: number,
    top: number,
    width: number,
    height: number
): ClientRect {
    return {
        bottom: top + height,
        height,
        left,
        right: left + width,
        top,
        width,
    };
}

function runCollision(
    detection: CollisionDetection,
    options: {
        activeId: string;
        activeType: "column" | "task";
        containers: DroppableContainer[];
        pointer: { x: number; y: number };
        rects: Map<string, ClientRect>;
    }
) {
    const collisionRect = rect(
        options.pointer.x - 20,
        options.pointer.y - 20,
        40,
        40
    );
    return detection({
        active: {
            data: { current: { type: options.activeType } },
            id: options.activeId,
            rect: { current: { initial: null, translated: null } },
        },
        collisionRect,
        droppableContainers: options.containers,
        droppableRects: options.rects,
        pointerCoordinates: options.pointer,
    });
}

describe("boardCollisionDetection", () => {
    const columns = [
        container("col-a", "column"),
        container("col-b", "column"),
        container("col-c", "column"),
    ];
    const task = container("task-1", "task");
    const all = [...columns, task];

    const columnRects = new Map<string, ClientRect>([
        ["col-a", rect(0, 0, 200, 400)],
        ["col-b", rect(220, 0, 200, 400)],
        ["col-c", rect(440, 0, 200, 400)],
        // Task sits inside col-b — unscoped closestCorners would prefer it.
        ["task-1", rect(240, 80, 160, 60)],
    ]);

    it("keeps column-drag fallback on columns when pointer is in a gap", () => {
        // Between col-a and col-b — pointerWithin empty, must not hit the task.
        const collisions = runCollision(boardCollisionDetection, {
            activeId: "col-a",
            activeType: "column",
            containers: all,
            pointer: { x: 210, y: 100 },
            rects: columnRects,
        });

        expect(collisions.map((hit) => hit.id)).not.toContain("task-1");
        expect(collisions.length).toBeGreaterThan(0);
        expect(
            collisions.every((hit) =>
                ["col-a", "col-b", "col-c"].includes(String(hit.id))
            )
        ).toBe(true);
    });

    it("uses pointerWithin when the pointer is inside a column", () => {
        const collisions = runCollision(boardCollisionDetection, {
            activeId: "col-a",
            activeType: "column",
            containers: all,
            pointer: { x: 300, y: 100 },
            rects: columnRects,
        });

        expect(collisions[0]?.id).toBe("col-b");
    });

    it("prefers an empty column task-list zone over distant cards", () => {
        const emptyColumnZone = container("column-tasks:col-b", "column-tasks");
        const containers = [...columns, emptyColumnZone, task];
        const rects = new Map<string, ClientRect>([
            ["col-a", rect(0, 0, 200, 400)],
            ["col-b", rect(220, 0, 200, 400)],
            ["col-c", rect(440, 0, 200, 400)],
            ["column-tasks:col-b", rect(220, 48, 200, 320)],
            ["task-1", rect(20, 80, 160, 60)],
        ]);

        const collisions = runCollision(boardCollisionDetection, {
            activeId: "task-1",
            activeType: "task",
            containers,
            pointer: { x: 300, y: 200 },
            rects,
        });

        expect(collisions[0]?.id).toBe("column-tasks:col-b");
    });

    it("prefers a task under the pointer over its column task-list zone", () => {
        const columnZone = container("column-tasks:col-b", "column-tasks");
        const containers = [...columns, columnZone, task];
        const rects = new Map<string, ClientRect>([
            ["col-a", rect(0, 0, 200, 400)],
            ["col-b", rect(220, 0, 200, 400)],
            ["col-c", rect(440, 0, 200, 400)],
            ["column-tasks:col-b", rect(220, 48, 200, 320)],
            ["task-1", rect(240, 80, 160, 60)],
        ]);

        const collisions = runCollision(boardCollisionDetection, {
            activeId: "task-2",
            activeType: "task",
            containers,
            pointer: { x: 280, y: 100 },
            rects,
        });

        expect(collisions[0]?.id).toBe("task-1");
    });

    it("maps a column body hit to that column task-list zone", () => {
        const emptyColumnZone = container("column-tasks:col-b", "column-tasks");
        const containers = [...columns, emptyColumnZone];
        const rects = new Map<string, ClientRect>([
            ["col-a", rect(0, 0, 200, 400)],
            ["col-b", rect(220, 0, 200, 400)],
            ["col-c", rect(440, 0, 200, 400)],
            ["column-tasks:col-b", rect(220, 320, 200, 48)],
            // Pointer sits in the upper empty column body, above the short zone.
        ]);

        const collisions = runCollision(boardCollisionDetection, {
            activeId: "task-2",
            activeType: "task",
            containers,
            pointer: { x: 300, y: 200 },
            rects,
        });

        expect(collisions[0]?.id).toBe("column-tasks:col-b");
    });
});
