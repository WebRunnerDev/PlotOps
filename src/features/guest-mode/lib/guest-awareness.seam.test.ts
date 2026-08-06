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

describe("Guest awareness static seed", () => {
    it("serves Activity, Comments, and Notifications from the sandbox without Supabase", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { fetchGuestTaskActivity } =
            await import("@/features/tasks/api/guest-task-activity");
        const { fetchGuestTaskComments } =
            await import("@/features/tasks/api/guest-task-comments");
        const { countGuestUnreadNotifications, listGuestNotifications } =
            await import("@/features/notifications/api/guest-notifications");
        const { fetchGuestTaskWatchers } =
            await import("@/features/notifications/api/guest-task-watchers");
        const { listGuestProjectPeople } =
            await import("@/features/projects/api/guest-project-people");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const taskId = sandbox.activity[0]!.taskId;
        const commentTaskId = sandbox.comments[0]!.taskId;
        const projectId = sandbox.projects[0]!.id;

        expect(fetchGuestTaskActivity(taskId).length).toBeGreaterThan(0);
        expect(fetchGuestTaskComments(commentTaskId).length).toBeGreaterThan(0);
        expect(
            listGuestNotifications({ limit: 20, offset: 0 }).length
        ).toBeGreaterThan(0);
        expect(countGuestUnreadNotifications()).toBeGreaterThan(0);
        expect(listGuestProjectPeople(projectId).length).toBeGreaterThan(0);
        expect(fetchGuestTaskWatchers({ taskId }).watchers).toEqual([]);
    });
});
