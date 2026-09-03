import { create } from "zustand";

type SelectTaskOptions = {
    focusCommentId?: string;
};

type TasksUiState = {
    archiveDialogOpenRequestKey: number;
    clearFocusComment: () => void;
    clearSelectedTask: () => void;
    clearTaskSwap: () => void;
    focusCommentId?: string;
    requestOpenArchiveDialog: () => void;
    selectedTaskId?: string;
    selectTask: (id: string, options?: SelectTaskOptions) => void;
    /** Bumps on each in-drawer Task switch so CSS enter animations remount. */
    taskSwapEpoch: number;
    /** Prior Task id for the active drawer swap animation. */
    taskSwapFromId?: string;
};

export const useTasksUiStore = create<TasksUiState>((set) => ({
    archiveDialogOpenRequestKey: 0,
    clearFocusComment: () => set({ focusCommentId: undefined }),
    clearSelectedTask: () =>
        set({
            focusCommentId: undefined,
            selectedTaskId: undefined,
            taskSwapEpoch: 0,
            taskSwapFromId: undefined,
        }),
    clearTaskSwap: () => set({ taskSwapFromId: undefined }),
    focusCommentId: undefined,
    requestOpenArchiveDialog: () =>
        set((state) => ({
            archiveDialogOpenRequestKey: state.archiveDialogOpenRequestKey + 1,
        })),
    selectedTaskId: undefined,
    selectTask: (id, options) =>
        set((state) => {
            const switching =
                Boolean(state.selectedTaskId) && state.selectedTaskId !== id;

            return {
                focusCommentId: options?.focusCommentId,
                selectedTaskId: id,
                taskSwapEpoch: switching
                    ? state.taskSwapEpoch + 1
                    : state.taskSwapEpoch,
                taskSwapFromId: switching
                    ? state.selectedTaskId
                    : state.taskSwapFromId,
            };
        }),
    taskSwapEpoch: 0,
    taskSwapFromId: undefined,
}));
