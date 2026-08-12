import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    type BoardSortPreference,
    DEFAULT_BOARD_SORT,
} from "@/features/tasks/lib/sort-tasks-by-board-sort";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

export type BoardSortState = {
    byBoardId: Record<string, BoardSortPreference>;
    getBoardSort: (boardId: string) => BoardSortPreference;
    setBoardSort: (boardId: string, sort: BoardSortPreference) => void;
};

export const createBoardSortStoreState: StateCreator<
    BoardSortState,
    [],
    [],
    BoardSortState
> = (set, get) => ({
    byBoardId: {},
    getBoardSort: (boardId) => get().byBoardId[boardId] ?? DEFAULT_BOARD_SORT,
    setBoardSort: (boardId, sort) =>
        set((state) => {
            if (sort.field === "manual") {
                if (!(boardId in state.byBoardId)) {
                    return state;
                }
                const next = { ...state.byBoardId };
                delete next[boardId];
                return { byBoardId: next };
            }
            return {
                byBoardId: {
                    ...state.byBoardId,
                    [boardId]: sort,
                },
            };
        }),
});

const safeLocalStorage = {
    getItem: (name: string) => safeGetItem("localStorage", name),
    removeItem: (name: string) => {
        safeRemoveItem("localStorage", name);
    },
    setItem: (name: string, value: string) => {
        safeSetItem("localStorage", name, value);
    },
};

export const useBoardSortStore = create<BoardSortState>()(
    persist(createBoardSortStoreState, {
        name: "plotops:board-sort",
        partialize: (state) => ({ byBoardId: state.byBoardId }),
        storage: createJSONStorage(() => safeLocalStorage),
    })
);
