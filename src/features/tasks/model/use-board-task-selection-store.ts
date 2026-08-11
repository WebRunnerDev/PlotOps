import { create } from "zustand";

type BoardTaskSelectionState = {
    boardId: null | string;
    clearSelection: () => void;
    selectedIds: ReadonlySet<string>;
    /** Switch board context; clears selection when board changes. */
    syncBoard: (boardId: string) => void;
    toggleTask: (boardId: string, taskId: string) => void;
};

export const useBoardTaskSelectionStore = create<BoardTaskSelectionState>(
    (set, get) => ({
        boardId: null,
        clearSelection: () => set({ selectedIds: new Set() }),
        selectedIds: new Set(),
        syncBoard: (boardId) => {
            if (get().boardId === boardId) return;
            set({ boardId, selectedIds: new Set() });
        },
        toggleTask: (boardId, taskId) => {
            const state = get();
            const next = new Set(
                state.boardId === boardId ? state.selectedIds : []
            );
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            set({ boardId, selectedIds: next });
        },
    })
);
