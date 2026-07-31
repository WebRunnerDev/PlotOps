import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearGitHubAccessToken,
    getGitHubAccessToken,
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
        setGitHubAccessToken("gh_token_1");

        expect(getGitHubAccessToken()).toBe("gh_token_1");
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe("gh_token_1");
    });

    it("clears memory and localStorage", () => {
        setGitHubAccessToken("gh_token_1");
        clearGitHubAccessToken();

        expect(getGitHubAccessToken()).toBeNull();
        expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("notifies subscribers on set and clear", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeGitHubAccessToken(listener);

        setGitHubAccessToken("gh_token_1");
        expect(listener).toHaveBeenCalledTimes(1);

        clearGitHubAccessToken();
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        setGitHubAccessToken("gh_token_2");
        expect(listener).toHaveBeenCalledTimes(2);
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
