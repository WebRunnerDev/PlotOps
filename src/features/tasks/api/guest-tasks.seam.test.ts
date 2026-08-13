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
            estimate: 5,
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
        expect(task!.estimate).toBe(5);
        expect(task!.status).toBe(columnIds[1]);

        const boardCache = await resolveAgain(true).fetchBoardTasks(boardId);
        expect(
            boardCache.tasks.some(
                (item) => item.id === created.id && item.status === columnIds[1]
            )
        ).toBe(true);
    });

    it("bulk archiveTaskRecords archives multiple guest tasks", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const boardId = board.id;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const a = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Bulk A"
        );
        const b = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Bulk B"
        );

        const { archivedCount } = await provider.archiveTaskRecords([
            a.id,
            b.id,
        ]);
        expect(archivedCount).toBe(2);

        const boardAfter = await provider.fetchBoardTasks(boardId);
        expect(boardAfter.tasks.some((task) => task.id === a.id)).toBe(false);
        expect(boardAfter.tasks.some((task) => task.id === b.id)).toBe(false);

        const archived = await provider.fetchArchivedTasks(boardId);
        expect(archived.some((task) => task.id === a.id)).toBe(true);
        expect(archived.some((task) => task.id === b.id)).toBe(true);
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

    it("createSubtaskRecord creates a full Task on the Parent Task's Board", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) => !task.parentId)!;
        const provider = resolveTasksProvider(true);
        const firstColumn = sandbox.boards.find(
            (board) => board.id === parent.boardId
        )!.columns[0]!;

        const created = await provider.createSubtaskRecord(
            parent.id,
            "Guest Subtask"
        );

        expect(created.parentId).toBe(parent.id);
        expect(created.parentKey).toBe(parent.key);
        expect(created.boardId).toBe(parent.boardId);
        expect(created.status).toBe(firstColumn.id);
        expect(created.title).toBe("Guest Subtask");

        const after = getGuestSandbox()!;
        const stored = after.tasks.find((task) => task.id === created.id);
        expect(stored?.parentId).toBe(parent.id);

        const parentActivity = after.activity.filter(
            (event) => event.taskId === parent.id
        );
        const childActivity = after.activity.filter(
            (event) => event.taskId === created.id
        );
        expect(
            parentActivity.some((event) =>
                event.metadata.changes.some(
                    (change) =>
                        change.field === "subtask" &&
                        (change.to as { key?: string }).key === created.key
                )
            )
        ).toBe(true);
        expect(
            childActivity.some((event) =>
                event.metadata.changes.some(
                    (change) =>
                        change.field === "parent" &&
                        (change.to as { key?: string }).key === parent.key
                )
            )
        ).toBe(true);
    });

    it("createSubtaskRecord refuses making a Subtask into a Parent Task", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const parent = sandbox.tasks.find((task) => !task.parentId)!;
        const child = await provider.createSubtaskRecord(
            parent.id,
            "Nested attempt parent"
        );

        await expect(
            provider.createSubtaskRecord(child.id, "Nested child")
        ).rejects.toThrow("A Subtask cannot have Subtasks");
    });

    it("clearTaskParent turns the Subtask into a root Task without deleting it", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) => !task.parentId)!;
        const provider = resolveTasksProvider(true);
        const created = await provider.createSubtaskRecord(
            parent.id,
            "Soon a root"
        );

        const cleared = await provider.clearTaskParent(created.id);
        expect(cleared.parentId).toBeUndefined();
        expect(cleared.parentKey).toBeUndefined();
        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === created.id)
        ).toBe(true);

        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const { resolveTasksProvider: resolveAgain } =
            await import("@/features/tasks/api/resolve-tasks-provider");
        const after = refreshed.getGuestSandbox()!;
        const task = after.tasks.find((item) => item.id === created.id);
        expect(task?.parentId).toBeUndefined();

        const boardCache = await resolveAgain(true).fetchBoardTasks(
            parent.boardId
        );
        const listed = boardCache.tasks.find((item) => item.id === created.id);
        expect(listed?.parentId).toBeUndefined();
        expect(listed?.title).toBe("Soon a root");
    });

    it("refuses moving a Parent Task into Done while a Subtask is not Done", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) =>
            sandbox.tasks.some(
                (child) =>
                    child.parentId === task.id &&
                    child.status !== "done" &&
                    child.archivedAt == undefined
            )
        )!;
        const board = sandbox.boards.find(
            (item) => item.id === parent.boardId
        )!;
        const doneColumn = board.columns.find((column) => column.isDone)!;
        const provider = resolveTasksProvider(true);

        await expect(
            provider.persistTaskMoves(parent.boardId, [
                { id: parent.id, position: 0, status: doneColumn.id },
            ])
        ).rejects.toThrow(
            "A Parent Task cannot enter Done while Subtasks are not Done"
        );

        expect(
            getGuestSandbox()!.tasks.find((task) => task.id === parent.id)
                ?.status
        ).toBe(parent.status);
    });

    it("refuses archive of a Parent Task while a Subtask is still active", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) =>
            sandbox.tasks.some(
                (child) =>
                    child.parentId === task.id && child.archivedAt == undefined
            )
        )!;
        const provider = resolveTasksProvider(true);

        await expect(provider.archiveTaskRecords([parent.id])).rejects.toThrow(
            "A Parent Task cannot be archived while Subtasks are still active"
        );

        expect(
            getGuestSandbox()!.tasks.find((task) => task.id === parent.id)
                ?.archivedAt
        ).toBeUndefined();
    });

    it("refuses hard-delete of a Parent Task while a Subtask exists", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) =>
            sandbox.tasks.some((child) => child.parentId === task.id)
        )!;
        const provider = resolveTasksProvider(true);

        for (const child of sandbox.tasks.filter(
            (task) => task.parentId === parent.id
        )) {
            await provider.archiveTaskRecord(child.id);
        }

        await expect(provider.deleteTaskRecord(parent.id)).rejects.toThrow(
            "A Parent Task cannot be deleted while Subtasks exist"
        );

        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === parent.id)
        ).toBe(true);
    });
});
