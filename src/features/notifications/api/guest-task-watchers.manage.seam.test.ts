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

describe("Guest manage Watchers", () => {
    it("allows self Watch and Unwatch", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        const { fetchGuestTaskWatchers, setGuestTaskWatch } =
            await import("@/features/notifications/api/guest-task-watchers");

        startGuestSession();
        const taskId = "guest-manage-self-task";

        setGuestTaskWatch({ taskId, watching: true });
        expect(fetchGuestTaskWatchers({ taskId }).isWatching).toBe(true);

        setGuestTaskWatch({ taskId, watching: false });
        expect(fetchGuestTaskWatchers({ taskId }).isWatching).toBe(false);
    });

    it("rejects manage-others in Guest Mode", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        const { setGuestTaskWatch } =
            await import("@/features/notifications/api/guest-task-watchers");

        startGuestSession();

        expect(() =>
            setGuestTaskWatch({
                taskId: "guest-manage-other-task",
                userId: "other-member-1",
                watching: true,
            })
        ).toThrow(/self-only|manage/i);
    });
});
