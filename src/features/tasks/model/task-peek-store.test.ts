import { beforeEach, describe, expect, it } from "vitest";

import { canPeekTask, useTaskPeekStore } from "./task-peek-store";

describe("task peek store", () => {
    beforeEach(() => {
        useTaskPeekStore.setState({ pageDrawerCount: 0, target: undefined });
    });

    it("allows a Peek while no page-owned Task drawer is mounted", () => {
        expect(canPeekTask()).toBe(true);
    });

    it("blocks a Peek while a Board drawer is mounted, and frees it on unmount", () => {
        const { registerPageDrawer } = useTaskPeekStore.getState();
        const unregisterBoard = registerPageDrawer();
        const unregisterSettings = registerPageDrawer();
        expect(canPeekTask()).toBe(false);

        unregisterBoard();
        expect(canPeekTask()).toBe(false);

        unregisterSettings();
        expect(canPeekTask()).toBe(true);
    });

    it("never counts below zero", () => {
        const unregister = useTaskPeekStore.getState().registerPageDrawer();
        unregister();
        unregister();
        expect(useTaskPeekStore.getState().pageDrawerCount).toBe(0);
    });

    it("keeps the Board context for the peeked Task", () => {
        useTaskPeekStore
            .getState()
            .setTarget({ boardId: "board-1", projectId: "project-1" });
        expect(useTaskPeekStore.getState().target).toEqual({
            boardId: "board-1",
            projectId: "project-1",
        });
    });
});
