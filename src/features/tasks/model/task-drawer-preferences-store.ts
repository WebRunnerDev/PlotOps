import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    clampSideDrawerWidth,
    DEFAULT_SIDE_DRAWER_WIDTH_PX,
    isTaskDrawerSide,
    type TaskDrawerSide,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

export type TaskDrawerPreferencesState = {
    drawerSide: TaskDrawerSide;
    openAfterCreate: boolean;
    setDrawerSide: (side: TaskDrawerSide) => void;
    setOpenAfterCreate: (open: boolean) => void;
    setSideDrawerWidthPx: (widthPx: number) => void;
    sideDrawerWidthPx: number;
};

export const createTaskDrawerPreferencesStoreState: StateCreator<
    TaskDrawerPreferencesState,
    [],
    [],
    TaskDrawerPreferencesState
> = (set) => ({
    drawerSide: "bottom",
    openAfterCreate: true,
    setDrawerSide: (side) => set({ drawerSide: side }),
    setOpenAfterCreate: (open) => set({ openAfterCreate: open }),
    setSideDrawerWidthPx: (widthPx) =>
        set({ sideDrawerWidthPx: clampSideDrawerWidth(widthPx) }),
    sideDrawerWidthPx: DEFAULT_SIDE_DRAWER_WIDTH_PX,
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

function mergeTaskDrawerPreferences(
    persisted: unknown,
    current: TaskDrawerPreferencesState
): TaskDrawerPreferencesState {
    const raw =
        persisted && typeof persisted === "object"
            ? (persisted as Partial<TaskDrawerPreferencesState>)
            : {};
    return {
        ...current,
        drawerSide: isTaskDrawerSide(raw.drawerSide)
            ? raw.drawerSide
            : current.drawerSide,
        openAfterCreate:
            typeof raw.openAfterCreate === "boolean"
                ? raw.openAfterCreate
                : current.openAfterCreate,
        sideDrawerWidthPx:
            typeof raw.sideDrawerWidthPx === "number"
                ? clampSideDrawerWidth(raw.sideDrawerWidthPx)
                : current.sideDrawerWidthPx,
    };
}

export const useTaskDrawerPreferencesStore =
    create<TaskDrawerPreferencesState>()(
        persist(createTaskDrawerPreferencesStoreState, {
            merge: mergeTaskDrawerPreferences,
            name: "plotops:task-drawer-preferences",
            partialize: (state) => ({
                drawerSide: state.drawerSide,
                openAfterCreate: state.openAfterCreate,
                sideDrawerWidthPx: state.sideDrawerWidthPx,
            }),
            storage: createJSONStorage(() => safeLocalStorage),
        })
    );

export { mergeTaskDrawerPreferences };
