import { create } from "zustand";

type CommandPaletteState = {
    close: () => void;
    isOpen: boolean;
    open: () => void;
    toggle: () => void;
};

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
    close: () => set({ isOpen: false }),
    isOpen: false,
    open: () => set({ isOpen: true }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
