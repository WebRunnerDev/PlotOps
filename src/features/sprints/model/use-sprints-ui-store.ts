import { create } from "zustand";

import type { BoardSprintScope } from "@/features/sprints/model/types";

type SprintsUiState = {
    boardSprintScope: BoardSprintScope;
    /**
     * Explicit Active-Sprint filter for Kanban. `null` = all Actives (default;
     * resets on reload with the store). Not persisted.
     */
    selectedActiveSprintIds: null | string[];
    setBoardSprintScope: (scope: BoardSprintScope) => void;
    setSelectedActiveSprintIds: (ids: null | string[]) => void;
};

export const useSprintsUiStore = create<SprintsUiState>((set) => ({
    boardSprintScope: "active",
    selectedActiveSprintIds: null,
    setBoardSprintScope: (scope) => set({ boardSprintScope: scope }),
    setSelectedActiveSprintIds: (ids) => set({ selectedActiveSprintIds: ids }),
}));
