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

describe("guest task comments", () => {
    it("reads seeded comments and supports local create without Supabase", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { createGuestTaskComment, fetchGuestTaskComments } =
            await import("@/features/tasks/api/guest-task-comments");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const seed = sandbox.comments[0]!;
        const before = fetchGuestTaskComments(seed.taskId).length;

        const created = createGuestTaskComment({
            body: "<p>Local-only note</p>",
            projectId: seed.projectId,
            taskId: seed.taskId,
        });

        expect(created.body).toContain("Local-only");
        expect(fetchGuestTaskComments(seed.taskId)).toHaveLength(before + 1);
        expect(
            getGuestSandbox()!.comments.some((row) => row.id === created.id)
        ).toBe(true);
    });
});
