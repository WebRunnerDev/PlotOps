import { describe, expect, it } from "vitest";

import { planBoardMoveWatcherNotification } from "./plan-board-move-watcher-notification";

describe("planBoardMoveWatcherNotification", () => {
    it("plans board_move with status remap when Board changes", () => {
        expect(
            planBoardMoveWatcherNotification([
                {
                    field: "board",
                    from: { id: "b1", name: "Core" },
                    to: { id: "b2", name: "Frontend" },
                },
                {
                    field: "status",
                    from: { id: "todo", name: "Todo" },
                    to: { id: "backlog", name: "Backlog" },
                },
            ])
        ).toEqual({
            kind: "board_move",
            metadata: {
                fromBoard: { id: "b1", name: "Core" },
                fromStatus: { id: "todo", name: "Todo" },
                source: "app",
                toBoard: { id: "b2", name: "Frontend" },
                toStatus: { id: "backlog", name: "Backlog" },
            },
        });
    });

    it("plans nothing for a same-Board status-only change", () => {
        expect(
            planBoardMoveWatcherNotification([
                {
                    field: "status",
                    from: { id: "todo", name: "Todo" },
                    to: { id: "doing", name: "Doing" },
                },
            ])
        ).toBeUndefined();
    });

    it("plans board_move without status when remap is absent", () => {
        expect(
            planBoardMoveWatcherNotification([
                {
                    field: "board",
                    from: { id: "b1", name: "Core" },
                    to: { id: "b2", name: "Frontend" },
                },
            ])
        ).toEqual({
            kind: "board_move",
            metadata: {
                fromBoard: { id: "b1", name: "Core" },
                fromStatus: undefined,
                source: "app",
                toBoard: { id: "b2", name: "Frontend" },
                toStatus: undefined,
            },
        });
    });
});
