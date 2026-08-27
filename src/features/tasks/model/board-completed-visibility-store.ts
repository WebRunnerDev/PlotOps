import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

export type BoardCompletedVisibilityState = {
    hideCompleted: (boardId: string) => boolean;
    hideCompletedByBoardId: Record<string, boolean>;
    setHideCompleted: (boardId: string, hide: boolean) => void;
};

export const createBoardCompletedVisibilityStoreState: StateCreator<
    BoardCompletedVisibilityState,
    [],
    [],
    BoardCompletedVisibilityState
> = (set, get) => ({
    hideCompleted: (boardId) => get().hideCompletedByBoardId[boardId] === true,
    hideCompletedByBoardId: {},
    setHideCompleted: (boardId, hide) =>
        set((state) => {
            if (!hide) {
                if (!(boardId in state.hideCompletedByBoardId)) {
                    return state;
                }
                const next = { ...state.hideCompletedByBoardId };
                delete next[boardId];
                return { hideCompletedByBoardId: next };
            }
            return {
                hideCompletedByBoardId: {
                    ...state.hideCompletedByBoardId,
                    [boardId]: true,
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

export const useBoardCompletedVisibilityStore =
    create<BoardCompletedVisibilityState>()(
        persist(createBoardCompletedVisibilityStoreState, {
            name: "plotops:board-hide-completed",
            partialize: (state) => ({
                hideCompletedByBoardId: state.hideCompletedByBoardId,
            }),
            storage: createJSONStorage(() => safeLocalStorage),
        })
    );
