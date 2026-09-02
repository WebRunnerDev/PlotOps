import { create } from "zustand";

import { resolveColumnSelectionRange } from "@/features/tasks/lib/board-task-selection";

type BoardTaskSelectionState = {
    anchorTaskId: null | string;
    boardId: null | string;
    clearSelection: () => void;
    selectedIds: ReadonlySet<string>;
    selectRangeInColumn: (
        boardId: string,
        columnTaskIds: readonly string[],
        targetId: string
    ) => void;
    /** Switch board context; clears selection when board changes. */
    syncBoard: (boardId: string) => void;
    toggleTask: (boardId: string, taskId: string) => void;
};

export const useBoardTaskSelectionStore = create<BoardTaskSelectionState>(
    (set, get) => ({
        anchorTaskId: null,
        boardId: null,
        clearSelection: () =>
            set({ anchorTaskId: null, selectedIds: new Set() }),
        selectedIds: new Set(),
        selectRangeInColumn: (boardId, columnTaskIds, targetId) => {
            const state = get();
            const rangeIds = resolveColumnSelectionRange(
                columnTaskIds,
                state.boardId === boardId ? state.anchorTaskId : null,
                targetId
            );
            const next = new Set(
                state.boardId === boardId ? state.selectedIds : []
            );
            for (const id of rangeIds) {
                next.add(id);
            }
            set({
                anchorTaskId: targetId,
                boardId,
                selectedIds: next,
            });
        },
        syncBoard: (boardId) => {
            if (get().boardId === boardId) return;
            set({ anchorTaskId: null, boardId, selectedIds: new Set() });
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
            set({ anchorTaskId: taskId, boardId, selectedIds: next });
        },
    })
);
