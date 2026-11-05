import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

/**
 * Last Repository each viewer chose for Create branch / PR on each Board
 * (ADR 0035 — there is no primary Repository). Keyed by `userId:boardId`.
 */
export type GitLinkRepositoryState = {
    lastRepositoryId: (
        userId: string | undefined,
        boardId: string
    ) => string | undefined;
    lastRepositoryIdByKey: Record<string, string>;
    setLastRepositoryId: (
        userId: string | undefined,
        boardId: string,
        repositoryId: string
    ) => void;
};

export function gitLinkRepositoryKey(
    userId: string | undefined,
    boardId: string
): string {
    return `${userId ?? "anon"}:${boardId}`;
}

export const createGitLinkRepositoryStoreState: StateCreator<
    GitLinkRepositoryState,
    [],
    [],
    GitLinkRepositoryState
> = (set, get) => ({
    lastRepositoryId: (userId, boardId) =>
        get().lastRepositoryIdByKey[gitLinkRepositoryKey(userId, boardId)],
    lastRepositoryIdByKey: {},
    setLastRepositoryId: (userId, boardId, repositoryId) =>
        set((state) => {
            const key = gitLinkRepositoryKey(userId, boardId);
            if (state.lastRepositoryIdByKey[key] === repositoryId) {
                return state;
            }
            return {
                lastRepositoryIdByKey: {
                    ...state.lastRepositoryIdByKey,
                    [key]: repositoryId,
                },
            };
        }),
});

const safeLocalStorage = {
    getItem: (name: string) => safeGetItem("localStorage", name),
    removeItem: (name: string) => {
        safeRemoveItem("localStorage", name);
    },
    setItem: (name: string, value: string) => {
        safeSetItem("localStorage", name, value);
    },
};

export const useGitLinkRepositoryStore = create<GitLinkRepositoryState>()(
    persist(createGitLinkRepositoryStoreState, {
        name: "plotops:git-link-repository",
        partialize: (state) => ({
            lastRepositoryIdByKey: state.lastRepositoryIdByKey,
        }),
        storage: createJSONStorage(() => safeLocalStorage),
    })
);
