import { create } from "zustand";

type SelectTaskOptions = {
    focusCommentId?: string;
};

type TasksUiState = {
    archiveDialogOpenRequestKey: number;
    clearFocusComment: () => void;
    clearSelectedTask: () => void;
    focusCommentId?: string;
    requestOpenArchiveDialog: () => void;
    selectedTaskId?: string;
    selectTask: (id: string, options?: SelectTaskOptions) => void;
};

export const useTasksUiStore = create<TasksUiState>((set) => ({
    archiveDialogOpenRequestKey: 0,
    clearFocusComment: () => set({ focusCommentId: undefined }),
    clearSelectedTask: () =>
        set({ focusCommentId: undefined, selectedTaskId: undefined }),
    focusCommentId: undefined,
    requestOpenArchiveDialog: () =>
        set((state) => ({
            archiveDialogOpenRequestKey: state.archiveDialogOpenRequestKey + 1,
        })),
    selectedTaskId: undefined,
    selectTask: (id, options) =>
        set({
            focusCommentId: options?.focusCommentId,
            selectedTaskId: id,
        }),
}));
