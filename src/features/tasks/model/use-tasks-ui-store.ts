import { create } from "zustand";

type TasksUiState = {
    clearSelectedTask: () => void;
    selectedTaskId?: string;
    selectTask: (id: string) => void;
};

export const useTasksUiStore = create<TasksUiState>((set) => ({
    clearSelectedTask: () => set({ selectedTaskId: undefined }),
    selectedTaskId: undefined,
    selectTask: (id) => set({ selectedTaskId: id }),
}));
