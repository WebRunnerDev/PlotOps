import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
    type BoardCompletedVisibilityState,
    createBoardCompletedVisibilityStoreState,
} from "./board-completed-visibility-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<BoardCompletedVisibilityState>()(
        persist(createBoardCompletedVisibilityStoreState, {
            name: "plotops:board-hide-completed-test",
            partialize: (state) => ({
                hideCompletedByBoardId: state.hideCompletedByBoardId,
            }),
            storage: createJSONStorage(() => storage),
        })
    );
}

function memoryStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (name: string) => map.get(name) ?? null,
        removeItem: (name: string) => {
            map.delete(name);
        },
        setItem: (name: string, value: string) => {
            map.set(name, value);
        },
    };
}

describe("board completed visibility store", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
    });

    it("defaults each board to showing completed tasks", () => {
        const store = createTestStore(storage);
        expect(store.getState().hideCompleted("board-a")).toBe(false);
    });

    it("stores the hide preference per boardId independently", () => {
        const store = createTestStore(storage);
        store.getState().setHideCompleted("board-a", true);
        store.getState().setHideCompleted("board-b", false);

        expect(store.getState().hideCompleted("board-a")).toBe(true);
        expect(store.getState().hideCompleted("board-b")).toBe(false);
    });

    it("persists hide completed across reload", async () => {
        const first = createTestStore(storage);
        first.getState().setHideCompleted("board-a", true);

        await first.persist.rehydrate();

        const second = createTestStore(storage);
        await second.persist.rehydrate();

        expect(second.getState().hideCompleted("board-a")).toBe(true);
        expect(second.getState().hideCompleted("board-b")).toBe(false);
    });
});
