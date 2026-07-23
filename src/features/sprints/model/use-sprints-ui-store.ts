import { create } from "zustand";

import type { BoardSprintScope } from "@/features/sprints/model/types";

type SprintsUiState = {
    boardSprintScope: BoardSprintScope;
    setBoardSprintScope: (scope: BoardSprintScope) => void;
};

export const useSprintsUiStore = create<SprintsUiState>((set) => ({
    boardSprintScope: "active",
    setBoardSprintScope: (scope) => set({ boardSprintScope: scope }),
}));
