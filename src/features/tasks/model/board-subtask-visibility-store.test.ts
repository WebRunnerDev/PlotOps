import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
    type BoardSubtaskVisibilityState,
    createBoardSubtaskVisibilityStoreState,
} from "./board-subtask-visibility-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<BoardSubtaskVisibilityState>()(
        persist(createBoardSubtaskVisibilityStoreState, {
            name: "plotops:board-hide-subtasks-test",
            partialize: (state) => ({
                hideSubtasksByBoardId: state.hideSubtasksByBoardId,
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

describe("board Subtask visibility store", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
    });

    it("defaults each Board to showing Subtasks", () => {
        const store = createTestStore(storage);
        expect(store.getState().hideSubtasks("board-a")).toBe(false);
    });

    it("stores the hide preference per boardId independently", () => {
        const store = createTestStore(storage);
        store.getState().setHideSubtasks("board-a", true);
        store.getState().setHideSubtasks("board-b", false);

        expect(store.getState().hideSubtasks("board-a")).toBe(true);
        expect(store.getState().hideSubtasks("board-b")).toBe(false);
    });

    it("persists hide Subtasks across reload", async () => {
        const first = createTestStore(storage);
        first.getState().setHideSubtasks("board-a", true);

        await first.persist.rehydrate();

        const second = createTestStore(storage);
        await second.persist.rehydrate();

        expect(second.getState().hideSubtasks("board-a")).toBe(true);
        expect(second.getState().hideSubtasks("board-b")).toBe(false);
    });
});
