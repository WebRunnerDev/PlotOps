import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guestTasksProvider } from "@/features/tasks/api/guest-tasks";
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
    return store;
}

beforeEach(() => {
    stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("guest tasks provider happy path", () => {
    it("create / edit / column move / status persist across refresh", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const projectId = board.projectId;
        const boardId = board.id;
        const columnIds = board.columns.map((column) => column.id);
        expect(columnIds.length).toBeGreaterThan(1);

        const provider = resolveTasksProvider(true);
        expect(provider).toBe(guestTasksProvider);

        const created = await provider.createTaskRecord(
            projectId,
            boardId,
            columnIds[0]!,
            "Guest happy-path task"
        );
        expect(created.title).toBe("Guest happy-path task");
        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === created.id)
        ).toBe(true);

        await provider.updateTaskDetails(created.id, {
            description: "Edited in sandbox",
            priority: "high",
            title: "Guest happy-path task (edited)",
        });

        await provider.persistTaskMoves(boardId, [
            {
                id: created.id,
                position: 0,
                status: columnIds[1]!,
            },
        ]);

        await provider.updateTaskRecord(created.id, {
            status: columnIds[1]!,
        });

        // Simulate in-session refresh: re-import guest-mode against same storage.
        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const { resolveTasksProvider: resolveAgain } =
            await import("@/features/tasks/api/resolve-tasks-provider");
        const after = refreshed.getGuestSandbox()!;
        const task = after.tasks.find((item) => item.id === created.id);
        expect(task).toBeDefined();
        expect(task!.title).toBe("Guest happy-path task (edited)");
        expect(task!.description).toBe("Edited in sandbox");
        expect(task!.priority).toBe("high");
        expect(task!.status).toBe(columnIds[1]);

        const boardCache = await resolveAgain(true).fetchBoardTasks(boardId);
        expect(
            boardCache.tasks.some(
                (item) => item.id === created.id && item.status === columnIds[1]
            )
        ).toBe(true);
    });
});
