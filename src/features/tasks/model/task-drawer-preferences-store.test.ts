import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
    DEFAULT_SIDE_DRAWER_WIDTH_PX,
    MIN_SIDE_DRAWER_WIDTH_PX,
} from "@/features/tasks/lib/resolve-task-drawer-placement";

import {
    createTaskDrawerPreferencesStoreState,
    mergeTaskDrawerPreferences,
    type TaskDrawerPreferencesState,
} from "./task-drawer-preferences-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<TaskDrawerPreferencesState>()(
        persist(createTaskDrawerPreferencesStoreState, {
            merge: mergeTaskDrawerPreferences,
            name: "plotops:task-drawer-preferences-test",
            partialize: (state) => ({
                drawerSide: state.drawerSide,
                openAfterCreate: state.openAfterCreate,
                sideDrawerWidthPx: state.sideDrawerWidthPx,
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

describe("task drawer preferences store", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
    });

    it("defaults to opening the drawer after create and bottom placement", () => {
        const store = createTestStore(storage);
        expect(store.getState().openAfterCreate).toBe(true);
        expect(store.getState().drawerSide).toBe("bottom");
        expect(store.getState().sideDrawerWidthPx).toBe(
            DEFAULT_SIDE_DRAWER_WIDTH_PX
        );
    });

    it("updates open-after-create, drawer side, and side width", () => {
        const store = createTestStore(storage);
        store.getState().setOpenAfterCreate(false);
        store.getState().setDrawerSide("left");
        store.getState().setSideDrawerWidthPx(420);

        expect(store.getState().openAfterCreate).toBe(false);
        expect(store.getState().drawerSide).toBe("left");
        expect(store.getState().sideDrawerWidthPx).toBe(420);
    });

    it("clamps side width when setting", () => {
        const store = createTestStore(storage);
        store.getState().setSideDrawerWidthPx(10);
        expect(store.getState().sideDrawerWidthPx).toBe(
            MIN_SIDE_DRAWER_WIDTH_PX
        );
    });

    it("persists preferences across reload", async () => {
        const first = createTestStore(storage);
        first.getState().setOpenAfterCreate(false);
        first.getState().setDrawerSide("right");
        first.getState().setSideDrawerWidthPx(700);

        await first.persist.rehydrate();

        const second = createTestStore(storage);
        await second.persist.rehydrate();

        expect(second.getState().openAfterCreate).toBe(false);
        expect(second.getState().drawerSide).toBe("right");
        expect(second.getState().sideDrawerWidthPx).toBe(700);
    });

    it("ignores corrupt persisted drawer side", async () => {
        storage.setItem(
            "plotops:task-drawer-preferences-test",
            JSON.stringify({
                state: { drawerSide: "up", openAfterCreate: false },
                version: 0,
            })
        );

        const store = createTestStore(storage);
        await store.persist.rehydrate();

        expect(store.getState().drawerSide).toBe("bottom");
        expect(store.getState().openAfterCreate).toBe(false);
        expect(store.getState().sideDrawerWidthPx).toBe(
            DEFAULT_SIDE_DRAWER_WIDTH_PX
        );
    });
});
