import { describe, expect, it } from "vitest";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import {
    createGitLinkRepositoryStoreState,
    type GitLinkRepositoryState,
} from "./git-link-repository-store";

function createTestStore(storage = memoryStorage()) {
    return createStore<GitLinkRepositoryState>()(
        persist(createGitLinkRepositoryStoreState, {
            name: "plotops:git-link-repository-test",
            partialize: (state) => ({
                lastRepositoryIdByKey: state.lastRepositoryIdByKey,
            }),
            storage: createJSONStorage(() => storage),
        })
    );
}

function memoryStorage() {
    const map = new Map<string, string>();
    return {
        getItem: (name: string) => map.get(name) ?? null,
        removeItem: (name: string) => {
            map.delete(name);
        },
        setItem: (name: string, value: string) => {
            map.set(name, value);
        },
    };
}

describe("git link repository store", () => {
    it("remembers the last Repository per viewer and Board", () => {
        const store = createTestStore();
        store.getState().setLastRepositoryId("u1", "board-a", "repo-api");
        store.getState().setLastRepositoryId("u2", "board-a", "repo-web");

        expect(store.getState().lastRepositoryId("u1", "board-a")).toBe(
            "repo-api"
        );
        expect(store.getState().lastRepositoryId("u2", "board-a")).toBe(
            "repo-web"
        );
        expect(
            store.getState().lastRepositoryId("u1", "board-b")
        ).toBeUndefined();
    });

    it("persists across reloads", async () => {
        const storage = memoryStorage();
        createTestStore(storage)
            .getState()
            .setLastRepositoryId("u1", "board-a", "repo-api");

        const reloaded = createTestStore(storage);
        await reloaded.persist.rehydrate();
        expect(reloaded.getState().lastRepositoryId("u1", "board-a")).toBe(
            "repo-api"
        );
    });
});
