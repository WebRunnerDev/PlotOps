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

describe("Guest sandbox seed store", () => {
    it("start clones the canonical seed into an observable sandbox", async () => {
        const { getGuestSandbox, isGuest, startGuestSession } =
            await import("@/features/guest-mode");

        expect(getGuestSandbox()).toBeNull();

        startGuestSession();

        expect(isGuest()).toBe(true);
        const sandbox = getGuestSandbox();
        expect(sandbox).not.toBeNull();
        expect(sandbox!.teams.length).toBeGreaterThan(0);
        expect(sandbox!.projects.length).toBeGreaterThan(0);
        expect(sandbox!.boards.length).toBeGreaterThan(0);
        expect(sandbox!.tasks.length).toBeGreaterThan(0);
        expect(sandbox!.sprints.length).toBeGreaterThan(0);
        expect(sandbox!.activity.length).toBeGreaterThan(0);
        expect(sandbox!.comments.length).toBeGreaterThan(0);
        expect(sandbox!.notifications.length).toBeGreaterThan(0);
    });

    it("seed clone is independent of later sandbox writes", async () => {
        const { getGuestSandbox, startGuestSession, writeGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const baselineTitle = getGuestSandbox()!.tasks[0]?.title;
        expect(baselineTitle).toBeTruthy();

        const mutated = structuredClone(getGuestSandbox()!);
        mutated.tasks[0] = {
            ...mutated.tasks[0]!,
            title: "Mutation that must not stick after reset",
        };
        writeGuestSandbox(mutated);
        expect(getGuestSandbox()!.tasks[0]?.title).toBe(
            "Mutation that must not stick after reset"
        );

        const { resetGuestSession } = await import("@/features/guest-mode");
        resetGuestSession();

        expect(getGuestSandbox()!.tasks[0]?.title).toBe(baselineTitle);
    });

    it("sandbox mutations survive a module reload in the same browser session", async () => {
        const { getGuestSandbox, startGuestSession, writeGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const mutated = structuredClone(getGuestSandbox()!);
        mutated.projects[0] = {
            ...mutated.projects[0]!,
            name: "Renamed mid-demo project",
        };
        writeGuestSandbox(mutated);

        vi.resetModules();
        const { getGuestSandbox: getAfterReload, isGuest } =
            await import("@/features/guest-mode");

        expect(isGuest()).toBe(true);
        expect(getAfterReload()?.projects[0]?.name).toBe(
            "Renamed mid-demo project"
        );
    });

    it("reset reclones the clean seed while keeping the Guest Session", async () => {
        const {
            getGuestSandbox,
            isGuest,
            resetGuestSession,
            startGuestSession,
            writeGuestSandbox,
        } = await import("@/features/guest-mode");

        startGuestSession();
        const baseline = structuredClone(getGuestSandbox()!);

        const mutated = structuredClone(baseline);
        mutated.teams[0] = {
            ...mutated.teams[0]!,
            name: "Polluted team name",
        };
        mutated.tasks = mutated.tasks.slice(1);
        writeGuestSandbox(mutated);

        const afterReset = resetGuestSession();

        expect(isGuest()).toBe(true);
        expect(afterReset).not.toBeNull();
        expect(getGuestSandbox()).toEqual(baseline);
    });

    it("leave clears the sandbox; reload stays cleared", async () => {
        const {
            getGuestSandbox,
            leaveGuestSession,
            startGuestSession,
            writeGuestSandbox,
        } = await import("@/features/guest-mode");

        startGuestSession();
        const mutated = structuredClone(getGuestSandbox()!);
        mutated.notifications = [];
        writeGuestSandbox(mutated);
        leaveGuestSession();

        expect(getGuestSandbox()).toBeNull();

        vi.resetModules();
        const { getGuestSandbox: getAfterReload, isGuest } =
            await import("@/features/guest-mode");

        expect(isGuest()).toBe(false);
        expect(getAfterReload()).toBeNull();
    });

    it("writeGuestSandbox is a no-op when no Guest Session is active", async () => {
        const { getGuestSandbox, writeGuestSandbox } =
            await import("@/features/guest-mode");

        writeGuestSandbox({
            activity: [],
            boards: [],
            comments: [],
            labels: [],
            notifications: [],
            projects: [],
            sprints: [],
            tasks: [],
            teams: [],
        });

        expect(getGuestSandbox()).toBeNull();
    });
});
