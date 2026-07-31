import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
    getGitHubAccessTokenOwnerId,
    retainGitHubAccessTokenForUser,
    setGitHubAccessToken,
    subscribeGitHubAccessToken,
    validateGitHubAccessToken,
} from "@/features/auth/model/github-token";

const STORAGE_KEY = "plotops_github_provider_token";

function createMemoryStorage(): Storage {
    const store = new Map<string, string>();
    return {
        clear: () => {
            store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

describe("GitHub access token SoT", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", createMemoryStorage());
        clearGitHubAccessToken();
    });

    afterEach(() => {
        clearGitHubAccessToken();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("stores and returns the token from memory and localStorage", () => {
        setGitHubAccessToken("gh_token_1", "user_a");

        expect(getGitHubAccessToken()).toBe("gh_token_1");
        expect(getGitHubAccessTokenOwnerId()).toBe("user_a");
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain(
            "gh_token_1"
        );
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toContain(
            "user_a"
        );
    });

    it("clears memory and localStorage", () => {
        setGitHubAccessToken("gh_token_1", "user_a");
        clearGitHubAccessToken();

        expect(getGitHubAccessToken()).toBeNull();
        expect(getGitHubAccessTokenOwnerId()).toBeNull();
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("notifies subscribers on set and clear", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeGitHubAccessToken(listener);

        setGitHubAccessToken("gh_token_1", "user_a");
        expect(listener).toHaveBeenCalledTimes(1);

        clearGitHubAccessToken();
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        setGitHubAccessToken("gh_token_2", "user_b");
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("clears a cached token when a different user signs in without provider_token", () => {
        setGitHubAccessToken("gh_token_user_a", "user_a");

        expect(retainGitHubAccessTokenForUser("user_b")).toBeNull();
        expect(getGitHubAccessToken()).toBeNull();
        expect(getGitHubAccessTokenOwnerId()).toBeNull();
    });

    it("keeps a cached token when it belongs to the current user", () => {
        setGitHubAccessToken("gh_token_user_a", "user_a");

        expect(retainGitHubAccessTokenForUser("user_a")).toBe(
            "gh_token_user_a"
        );
        expect(getGitHubAccessToken()).toBe("gh_token_user_a");
        expect(getGitHubAccessTokenOwnerId()).toBe("user_a");
    });

    it("discards a legacy unbound token from localStorage", () => {
        clearGitHubAccessToken();
        globalThis.localStorage.setItem(STORAGE_KEY, "legacy_plain_token");

        expect(retainGitHubAccessTokenForUser("user_a")).toBeNull();
        expect(getGitHubAccessToken()).toBeNull();
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("validateGitHubAccessToken returns true on ok response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
            })
        );

        await expect(validateGitHubAccessToken("good")).resolves.toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            "https://api.github.com/user",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer good",
                }),
            })
        );
    });

    it("validateGitHubAccessToken returns false on 401", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            })
        );

        await expect(validateGitHubAccessToken("stale")).resolves.toBe(false);
    });

    it("validateGitHubAccessToken keeps the token on network failure", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
        );

        await expect(validateGitHubAccessToken("maybe")).resolves.toBe(true);
    });
});
