import { beforeEach, describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import { DEFAULT_TEAM_TASKS_PREFERENCES } from "./team-tasks-view";
import {
    createTeamTasksViewStoreState,
    resolveTeamTasksPreferences,
    type TeamTasksViewState,
} from "./team-tasks-view-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<TeamTasksViewState>()(
        persist(createTeamTasksViewStoreState, {
            name: "plotops:team-tasks-view-test",
            partialize: (state) => ({ byTeamId: state.byTeamId }),
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

describe("Team Tasks view store", () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
    });

    it("resolves defaults for a Team with nothing stored", () => {
        const store = createTestStore(storage);

        expect(
            resolveTeamTasksPreferences(store.getState().byTeamId["team-1"])
        ).toEqual(DEFAULT_TEAM_TASKS_PREFERENCES);
    });

    it("merges patches per Team without touching other Teams", () => {
        const store = createTestStore(storage);

        store.getState().setPreferences("team-1", { groupBy: "deadline" });
        store.getState().setPreferences("team-1", { hideDone: false });
        store.getState().setPreferences("team-2", { assignee: "any" });

        expect(
            resolveTeamTasksPreferences(store.getState().byTeamId["team-1"])
        ).toEqual({
            ...DEFAULT_TEAM_TASKS_PREFERENCES,
            groupBy: "deadline",
            hideDone: false,
        });
        expect(store.getState().byTeamId["team-2"]).toEqual({
            assignee: "any",
        });
    });

    it("survives a reload", () => {
        createTestStore(storage)
            .getState()
            .setPreferences("team-1", {
                projectIds: ["project-a"],
                sort: { direction: "desc", field: "priority" },
            });

        const reloaded = createTestStore(storage);

        expect(
            resolveTeamTasksPreferences(reloaded.getState().byTeamId["team-1"])
        ).toEqual({
            ...DEFAULT_TEAM_TASKS_PREFERENCES,
            projectIds: ["project-a"],
            sort: { direction: "desc", field: "priority" },
        });
    });
});
