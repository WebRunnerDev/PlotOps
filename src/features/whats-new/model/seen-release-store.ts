import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

type SeenReleaseState = {
    /** Last release whose What's new entry this browser opened. */
    lastSeenVersion: null | string;
    markSeen: (version: string) => void;
};

const safeLocalStorage = {
    getItem: (name: string) => safeGetItem("localStorage", name),
    removeItem: (name: string) => {
        safeRemoveItem("localStorage", name);
    },
    setItem: (name: string, value: string) => {
        safeSetItem("localStorage", name, value);
    },
};

export const useSeenReleaseStore = create<SeenReleaseState>()(
    persist(
        (set) => ({
            lastSeenVersion: null,
            markSeen: (version) => set({ lastSeenVersion: version }),
        }),
        {
            name: "plotops:whats-new-seen",
            partialize: (state) => ({ lastSeenVersion: state.lastSeenVersion }),
            storage: createJSONStorage(() => safeLocalStorage),
        }
    )
);
