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

    it("archive / delete persisted archived task without Supabase", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const boardId = board.id;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const created = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Archived then deleted"
        );
        await provider.archiveTaskRecord(created.id);
        await provider.deleteTaskRecord(created.id);

        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === created.id)
        ).toBe(false);
        const archived = await provider.fetchArchivedTasks(boardId);
        expect(archived.some((task) => task.id === created.id)).toBe(false);
    });

    it("archive / list archived / restore persist across refresh", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const boardId = board.id;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const created = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Task to archive"
        );

        await provider.archiveTaskRecord(created.id);

        const boardAfterArchive = await provider.fetchBoardTasks(boardId);
        expect(
            boardAfterArchive.tasks.some((task) => task.id === created.id)
        ).toBe(false);

        const archived = await provider.fetchArchivedTasks(boardId);
        expect(archived).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    archivedAt: expect.any(String),
                    id: created.id,
                    title: "Task to archive",
                }),
            ])
        );

        await provider.restoreTaskRecord(created.id, boardId);

        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const { resolveTasksProvider: resolveAgain } =
            await import("@/features/tasks/api/resolve-tasks-provider");
        const after = refreshed.getGuestSandbox()!;
        const task = after.tasks.find((item) => item.id === created.id);
        expect(task?.archivedAt).toBeUndefined();

        const boardCache = await resolveAgain(true).fetchBoardTasks(boardId);
        expect(boardCache.tasks.some((item) => item.id === created.id)).toBe(
            true
        );
        const stillArchived =
            await resolveAgain(true).fetchArchivedTasks(boardId);
        expect(stillArchived.some((item) => item.id === created.id)).toBe(
            false
        );
    });

    it("exposes createdAt on Board fetches for Created Board sort", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const boardId = getGuestSandbox()!.boards[0]!.id;
        const { tasks } =
            await resolveTasksProvider(true).fetchBoardTasks(boardId);

        expect(tasks.length).toBeGreaterThan(0);
        expect(
            tasks.every(
                (task) =>
                    typeof task.createdAt === "string" &&
                    task.createdAt.length > 0
            )
        ).toBe(true);
    });
});
