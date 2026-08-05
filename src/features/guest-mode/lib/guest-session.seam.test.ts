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
    return store;
}

beforeEach(() => {
    stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("Guest Session lifecycle facade", () => {
    it("is not Guest before a session starts", async () => {
        const { getGuestDisplayIdentity, isGuest } =
            await import("@/features/guest-mode");

        expect(isGuest()).toBe(false);
        expect(getGuestDisplayIdentity()).toBeNull();
    });

    it("start makes Guest observable with synthetic display identity", async () => {
        const { getGuestDisplayIdentity, isGuest, startGuestSession } =
            await import("@/features/guest-mode");

        const identity = startGuestSession();

        expect(isGuest()).toBe(true);
        expect(identity.username.length).toBeGreaterThan(0);
        expect(identity.firstName.length).toBeGreaterThan(0);
        expect(identity.lastName.length).toBeGreaterThan(0);
        expect(getGuestDisplayIdentity()).toEqual(identity);
    });

    it("Guest remains observable after a module reload in the same browser session", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        startGuestSession();

        vi.resetModules();
        const { getGuestDisplayIdentity, isGuest } =
            await import("@/features/guest-mode");

        expect(isGuest()).toBe(true);
        expect(getGuestDisplayIdentity()).not.toBeNull();
    });

    it("leave ends the Guest Session", async () => {
        const {
            getGuestDisplayIdentity,
            isGuest,
            leaveGuestSession,
            startGuestSession,
        } = await import("@/features/guest-mode");

        startGuestSession();
        leaveGuestSession();

        expect(isGuest()).toBe(false);
        expect(getGuestDisplayIdentity()).toBeNull();
    });

    it("reset keeps Guest Mode while reseating the empty sandbox", async () => {
        const {
            getGuestDisplayIdentity,
            isGuest,
            resetGuestSession,
            startGuestSession,
        } = await import("@/features/guest-mode");

        const first = startGuestSession();
        const afterReset = resetGuestSession();

        expect(isGuest()).toBe(true);
        expect(afterReset).toEqual(getGuestDisplayIdentity());
        expect(afterReset).toEqual(first);
    });

    it("reset is a no-op when no Guest Session is active", async () => {
        const { isGuest, resetGuestSession } =
            await import("@/features/guest-mode");

        expect(resetGuestSession()).toBeNull();
        expect(isGuest()).toBe(false);
    });

    it("leave remains cleared after a module reload", async () => {
        const { leaveGuestSession, startGuestSession } =
            await import("@/features/guest-mode");
        startGuestSession();
        leaveGuestSession();

        vi.resetModules();
        const { getGuestDisplayIdentity, isGuest } =
            await import("@/features/guest-mode");

        expect(isGuest()).toBe(false);
        expect(getGuestDisplayIdentity()).toBeNull();
    });
});
