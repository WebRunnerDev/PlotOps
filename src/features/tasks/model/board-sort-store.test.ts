import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
    type BoardSortPreference,
    DEFAULT_BOARD_SORT,
} from "../lib/sort-tasks-by-board-sort";
import {
    type BoardSortState,
    createBoardSortStoreState,
} from "./board-sort-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<BoardSortState>()(
        persist(createBoardSortStoreState, {
            name: "plotops:board-sort-test",
            partialize: (state) => ({ byBoardId: state.byBoardId }),
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

describe("board sort store", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
    });

    it("defaults each Board to Manual", () => {
        const store = createTestStore(storage);
        expect(store.getState().getBoardSort("board-a")).toEqual(
            DEFAULT_BOARD_SORT
        );
    });

    it("stores Board sort per boardId independently", () => {
        const store = createTestStore(storage);
        const priorityDesc: BoardSortPreference = {
            direction: "desc",
            field: "priority",
        };
        const priorityAsc: BoardSortPreference = {
            direction: "asc",
            field: "priority",
        };

        store.getState().setBoardSort("board-a", priorityDesc);
        store.getState().setBoardSort("board-b", priorityAsc);

        expect(store.getState().getBoardSort("board-a")).toEqual(priorityDesc);
        expect(store.getState().getBoardSort("board-b")).toEqual(priorityAsc);
    });

    it("restores Manual after clearing Priority Board sort", () => {
        const store = createTestStore(storage);
        store.getState().setBoardSort("board-a", {
            direction: "desc",
            field: "priority",
        });
        store.getState().setBoardSort("board-a", { field: "manual" });

        expect(store.getState().getBoardSort("board-a")).toEqual(
            DEFAULT_BOARD_SORT
        );
    });

    it("persists only field and direction per Board across reload", async () => {
        const first = createTestStore(storage);
        first.getState().setBoardSort("board-a", {
            direction: "asc",
            field: "created",
        });

        await first.persist.rehydrate();

        const second = createTestStore(storage);
        await second.persist.rehydrate();

        expect(second.getState().getBoardSort("board-a")).toEqual({
            direction: "asc",
            field: "created",
        });
        expect(second.getState().byBoardId["board-a"]).toEqual({
            direction: "asc",
            field: "created",
        });
        expect(
            JSON.stringify(storage.getItem("plotops:board-sort-test"))
        ).not.toMatch(/position/);
    });
});
