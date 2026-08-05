import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    });
}

beforeEach(() => {
    stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("hasMainAppAccess", () => {
    it("allows a real Auth session without Guest", async () => {
        const { hasMainAppAccess } =
            await import("@/features/guest-mode/lib/main-app-access");
        expect(hasMainAppAccess(true)).toBe(true);
        expect(hasMainAppAccess(false)).toBe(false);
    });

    it("allows a Guest Session without Auth", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        const { hasMainAppAccess } =
            await import("@/features/guest-mode/lib/main-app-access");

        startGuestSession();

        expect(hasMainAppAccess(false)).toBe(true);
        expect(hasMainAppAccess(true)).toBe(true);
    });
});
