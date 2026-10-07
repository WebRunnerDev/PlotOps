import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

import {
    DEFAULT_TEAM_TASKS_PREFERENCES,
    type TeamTasksPreferences,
} from "./team-tasks-view";

export type TeamTasksViewState = {
    byTeamId: Record<string, Partial<TeamTasksPreferences>>;
    setPreferences: (
        teamId: string,
        patch: Partial<TeamTasksPreferences>
    ) => void;
};

/** Stored preferences over the defaults — tolerates older, partial entries. */
export function resolveTeamTasksPreferences(
    stored: Partial<TeamTasksPreferences> | undefined
): TeamTasksPreferences {
    return { ...DEFAULT_TEAM_TASKS_PREFERENCES, ...stored };
}

export const createTeamTasksViewStoreState: StateCreator<
    TeamTasksViewState,
    [],
    [],
    TeamTasksViewState
> = (set) => ({
    byTeamId: {},
    setPreferences: (teamId, patch) =>
        set((state) => ({
            byTeamId: {
                ...state.byTeamId,
                [teamId]: { ...state.byTeamId[teamId], ...patch },
            },
        })),
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

export const useTeamTasksViewStore = create<TeamTasksViewState>()(
    persist(createTeamTasksViewStoreState, {
        name: "plotops:team-tasks-view",
        partialize: (state) => ({ byTeamId: state.byTeamId }),
        storage: createJSONStorage(() => safeLocalStorage),
    })
);
