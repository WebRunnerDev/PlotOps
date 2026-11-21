import { create } from "zustand";

export type TaskPeekTarget = {
    boardId: string;
    projectId: string;
};

type TaskPeekState = {
    /** Page-owned Task drawers (Board, Backlog, Settings) currently mounted. */
    pageDrawerCount: number;
    /** Mount a page-owned Task drawer; returns the matching unmount. */
    registerPageDrawer: () => () => void;
    setTarget: (target: TaskPeekTarget) => void;
    /** Board context for the Task Peek drawer (Task drawer away from its Board). */
    target?: TaskPeekTarget;
};

/**
 * Task Peek: open a Task drawer on a page that has no Board (Notifications,
 * Home…). Page-owned drawers register so Peek stays out of their way.
 */
export const useTaskPeekStore = create<TaskPeekState>((set) => ({
    pageDrawerCount: 0,
    registerPageDrawer: () => {
        set((state) => ({ pageDrawerCount: state.pageDrawerCount + 1 }));
        return () => {
            set((state) => ({
                pageDrawerCount: Math.max(0, state.pageDrawerCount - 1),
            }));
        };
    },
    setTarget: (target) => set({ target }),
    target: undefined,
}));

/** True when no page-owned Task drawer is mounted — Peek may open a Task. */
export function canPeekTask(): boolean {
    return useTaskPeekStore.getState().pageDrawerCount === 0;
}
