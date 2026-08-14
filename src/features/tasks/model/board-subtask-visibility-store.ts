import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

export type BoardSubtaskVisibilityState = {
    hideSubtasks: (boardId: string) => boolean;
    hideSubtasksByBoardId: Record<string, boolean>;
    setHideSubtasks: (boardId: string, hide: boolean) => void;
};

export const createBoardSubtaskVisibilityStoreState: StateCreator<
    BoardSubtaskVisibilityState,
    [],
    [],
    BoardSubtaskVisibilityState
> = (set, get) => ({
    hideSubtasks: (boardId) => get().hideSubtasksByBoardId[boardId] === true,
    hideSubtasksByBoardId: {},
    setHideSubtasks: (boardId, hide) =>
        set((state) => {
            if (!hide) {
                if (!(boardId in state.hideSubtasksByBoardId)) {
                    return state;
                }
                const next = { ...state.hideSubtasksByBoardId };
                delete next[boardId];
                return { hideSubtasksByBoardId: next };
            }
            return {
                hideSubtasksByBoardId: {
                    ...state.hideSubtasksByBoardId,
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

export const useBoardSubtaskVisibilityStore =
    create<BoardSubtaskVisibilityState>()(
        persist(createBoardSubtaskVisibilityStoreState, {
            name: "plotops:board-hide-subtasks",
            partialize: (state) => ({
                hideSubtasksByBoardId: state.hideSubtasksByBoardId,
            }),
            storage: createJSONStorage(() => safeLocalStorage),
        })
    );
