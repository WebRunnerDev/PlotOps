import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    fetchGuestTaskWatchers,
    setGuestTaskWatch,
} from "@/features/notifications/api/guest-task-watchers";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";

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

describe("Guest sticky Watch enrollment", () => {
    it("keeps Watch after Assignee is cleared", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const provider = resolveTasksProvider(true);

        const created = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Sticky assignee clear",
            undefined,
            undefined,
            { assigneeId: GUEST_SEED_ACTOR_ID }
        );

        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            true
        );

        await provider.updateTaskRecord(created.id, { assignee_id: null });

        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            true
        );
    });

    it("does not re-enroll after sticky Unwatch until Assignee is set again", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const provider = resolveTasksProvider(true);
        const otherAssignee = "c0000000-0000-4000-8000-000000009999";

        const created = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Sticky unwatch",
            undefined,
            undefined,
            { assigneeId: GUEST_SEED_ACTOR_ID }
        );

        setGuestTaskWatch({ taskId: created.id, watching: false });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            false
        );

        await provider.updateTaskRecord(created.id, {
            author_id: otherAssignee,
        });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            false
        );

        await provider.updateTaskRecord(created.id, {
            assignee_id: otherAssignee,
        });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            false
        );

        await provider.updateTaskRecord(created.id, {
            assignee_id: GUEST_SEED_ACTOR_ID,
        });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            true
        );
    });

    it("keeps Watch after Author transfer and re-enrolls when Author is set again", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const provider = resolveTasksProvider(true);
        const otherAuthor = "c0000000-0000-4000-8000-000000009998";

        const created = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Sticky author transfer"
        );

        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            true
        );

        setGuestTaskWatch({ taskId: created.id, watching: false });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            false
        );

        await provider.updateTaskRecord(created.id, {
            author_id: otherAuthor,
        });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            false
        );

        await provider.updateTaskRecord(created.id, {
            author_id: GUEST_SEED_ACTOR_ID,
        });
        expect(fetchGuestTaskWatchers({ taskId: created.id }).isWatching).toBe(
            true
        );
    });
});
