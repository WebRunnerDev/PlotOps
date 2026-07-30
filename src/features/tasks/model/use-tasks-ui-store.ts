import { create } from "zustand";

type SelectTaskOptions = {
    focusCommentId?: string;
};

type TasksUiState = {
    clearFocusComment: () => void;
    clearSelectedTask: () => void;
    focusCommentId?: string;
    selectedTaskId?: string;
    selectTask: (id: string, options?: SelectTaskOptions) => void;
};

export const useTasksUiStore = create<TasksUiState>((set) => ({
    clearFocusComment: () => set({ focusCommentId: undefined }),
    clearSelectedTask: () =>
        set({ focusCommentId: undefined, selectedTaskId: undefined }),
    focusCommentId: undefined,
    selectedTaskId: undefined,
    selectTask: (id, options) =>
        set({
            focusCommentId: options?.focusCommentId,
            selectedTaskId: id,
        }),
}));
