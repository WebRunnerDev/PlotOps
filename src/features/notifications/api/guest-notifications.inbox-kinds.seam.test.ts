import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const JIRA_LIKE_WATCHER_KINDS = [
    "comment",
    "title_change",
    "description_change",
    "labels_change",
    "estimate_change",
    "sprint_change",
] as const;

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

describe("Guest inbox Jira-like Watcher kinds", () => {
    it("seeds representative Notification rows for each new Watcher kind", async () => {
        const { GUEST_DEMO_SEED } =
            await import("@/features/guest-mode/lib/guest-demo-seed");

        for (const kind of JIRA_LIKE_WATCHER_KINDS) {
            expect(
                GUEST_DEMO_SEED.notifications.some((row) => row.kind === kind)
            ).toBe(true);
        }
    });

    it("matches en kind aliases via search q", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        const { listGuestNotifications } =
            await import("@/features/notifications/api/guest-notifications");

        startGuestSession();

        const titleHits = listGuestNotifications({
            limit: 50,
            offset: 0,
            q: "title",
        });
        expect(titleHits.some((row) => row.kind === "title_change")).toBe(true);
        expect(titleHits.every((row) => row.kind === "title_change")).toBe(
            true
        );

        const commentHits = listGuestNotifications({
            limit: 50,
            offset: 0,
            q: "comment",
        });
        expect(commentHits.some((row) => row.kind === "comment")).toBe(true);
    });

    it("matches ru kind aliases via search q without locale switch", async () => {
        const { startGuestSession } = await import("@/features/guest-mode");
        const { listGuestNotifications } =
            await import("@/features/notifications/api/guest-notifications");

        startGuestSession();

        const descriptionHits = listGuestNotifications({
            limit: 50,
            offset: 0,
            q: "описание",
        });
        expect(
            descriptionHits.some((row) => row.kind === "description_change")
        ).toBe(true);
        expect(
            descriptionHits.every((row) => row.kind === "description_change")
        ).toBe(true);

        const sprintHits = listGuestNotifications({
            limit: 50,
            offset: 0,
            q: "спринт",
        });
        expect(sprintHits.some((row) => row.kind === "sprint_change")).toBe(
            true
        );
    });
});
