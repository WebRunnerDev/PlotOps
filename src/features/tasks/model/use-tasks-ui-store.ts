import { create } from "zustand";

import type { BoardSprintScope } from "@/features/tasks/model/sprint-types";

type TasksUiState = {
    boardSprintScope: BoardSprintScope;
    clearSelectedTask: () => void;
    selectedTaskId?: string;
    selectTask: (id: string) => void;
    setBoardSprintScope: (scope: BoardSprintScope) => void;
};

export const useTasksUiStore = create<TasksUiState>((set) => ({
    boardSprintScope: "active",
    clearSelectedTask: () => set({ selectedTaskId: undefined }),
    selectedTaskId: undefined,
    selectTask: (id) => set({ selectedTaskId: id }),
    setBoardSprintScope: (scope) => set({ boardSprintScope: scope }),
}));
