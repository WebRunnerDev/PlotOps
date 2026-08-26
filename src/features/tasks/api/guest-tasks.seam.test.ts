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

    it("restores and permanently deletes multiple archived guest tasks", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const boardId = board.id;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const restoreA = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Restore A"
        );
        const restoreB = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Restore B"
        );
        const deleteA = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Delete A"
        );
        const deleteB = await provider.createTaskRecord(
            board.projectId,
            boardId,
            columnIds[0]!,
            "Delete B"
        );

        await provider.archiveTaskRecords([
            restoreA.id,
            restoreB.id,
            deleteA.id,
            deleteB.id,
        ]);

        for (const taskId of [restoreA.id, restoreB.id]) {
            await provider.restoreTaskRecord(taskId, boardId);
        }
        for (const taskId of [deleteA.id, deleteB.id]) {
            await provider.deleteTaskRecord(taskId);
        }

        const boardTasks = await provider.fetchBoardTasks(boardId);
        expect(boardTasks.tasks.some((task) => task.id === restoreA.id)).toBe(
            true
        );
        expect(boardTasks.tasks.some((task) => task.id === restoreB.id)).toBe(
            true
        );
        expect(boardTasks.tasks.some((task) => task.id === deleteA.id)).toBe(
            false
        );
        expect(boardTasks.tasks.some((task) => task.id === deleteB.id)).toBe(
            false
        );

        const archived = await provider.fetchArchivedTasks(boardId);
        expect(archived.some((task) => task.id === restoreA.id)).toBe(false);
        expect(archived.some((task) => task.id === restoreB.id)).toBe(false);
        expect(archived.some((task) => task.id === deleteA.id)).toBe(false);
        expect(archived.some((task) => task.id === deleteB.id)).toBe(false);
        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === deleteA.id)
        ).toBe(false);
        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === deleteB.id)
        ).toBe(false);
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

    it("createSubtaskRecord joins the Parent Task's live Sprint when sprintId is omitted", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find(
            (task) => !task.parentId && task.sprintId
        )!;
        expect(parent.sprintId).toBeTruthy();

        const provider = resolveTasksProvider(true);
        const created = await provider.createSubtaskRecord(
            parent.id,
            "Sprint child"
        );

        expect(created.sprintId).toBe(parent.sprintId);
        expect(created.sprintPosition).toBeGreaterThanOrEqual(0);
    });

    it("createTaskRecord assigns the creator when the Board auto-assigns and the Team is solo", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const provider = resolveTasksProvider(true);

        const unassigned = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Unassigned by default"
        );
        expect(unassigned.assignee).toBeUndefined();

        const { updateGuestSandbox } = await import("@/features/guest-mode");
        updateGuestSandbox((current) => {
            const target = current.boards.find((item) => item.id === board.id);
            if (target) {
                target.autoAssignToCreator = true;
            }
        });

        const assigned = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Auto-assigned"
        );
        expect(assigned.assignee?.id).toBe(GUEST_SEED_ACTOR_ID);
    });

    it("createTaskRecord applies priority and assigneeId overrides from quick-add", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const provider = resolveTasksProvider(true);

        const high = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "High priority",
            "bug",
            undefined,
            { assigneeId: GUEST_SEED_ACTOR_ID, priority: "high" }
        );
        expect(high.type).toBe("bug");
        expect(high.priority).toBe("high");
        expect(high.assignee?.id).toBe(GUEST_SEED_ACTOR_ID);

        const cleared = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Cleared meta",
            undefined,
            undefined,
            { assigneeId: null, priority: null }
        );
        expect(cleared.assignee).toBeUndefined();
        expect(cleared.priority).toBeUndefined();
    });

    it("createSubtaskRecord assigns the creator when the Board auto-assigns", async () => {
        const { getGuestSandbox, GUEST_SEED_ACTOR_ID, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find((task) => !task.parentId)!;
        const { updateGuestSandbox } = await import("@/features/guest-mode");
        updateGuestSandbox((current) => {
            const board = current.boards.find(
                (item) => item.id === parent.boardId
            );
            if (board) {
                board.autoAssignToCreator = true;
            }
        });

        const provider = resolveTasksProvider(true);
        const created = await provider.createSubtaskRecord(
            parent.id,
            "Auto-assigned Subtask"
        );
        expect(created.assignee?.id).toBe(GUEST_SEED_ACTOR_ID);
    });

    it("restoreTaskRecord joins a Subtask to the Parent Task's live Sprint", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const parent = sandbox.tasks.find(
            (task) =>
                !task.parentId &&
                task.sprintId &&
                sandbox.tasks.some((child) => child.parentId === task.id)
        )!;
        const child = sandbox.tasks.find(
            (task) => task.parentId === parent.id && !task.sprintId
        )!;
        expect(parent.sprintId).toBeTruthy();
        expect(child.archivedAt).toBeUndefined();

        const provider = resolveTasksProvider(true);
        await provider.archiveTaskRecord(child.id);
        await provider.restoreTaskRecord(child.id, child.boardId);

        const restored = getGuestSandbox()!.tasks.find(
            (task) => task.id === child.id
        );
        expect(restored?.archivedAt).toBeUndefined();
        expect(restored?.sprintId).toBe(parent.sprintId);
        expect(restored?.sprintPosition).toBeGreaterThanOrEqual(0);
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

    it("archives a Parent Task together with its active Subtasks in one batch", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const parent = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Batch parent"
        );
        const child = await provider.createSubtaskRecord(
            parent.id,
            "Batch child"
        );

        const { archivedCount } = await provider.archiveTaskRecords([
            parent.id,
            child.id,
        ]);
        expect(archivedCount).toBe(2);

        const archived = await provider.fetchArchivedTasks(board.id);
        expect(archived.some((task) => task.id === parent.id)).toBe(true);
        expect(archived.some((task) => task.id === child.id)).toBe(true);
    });

    it("deletes archived Parent and Subtask when Subtasks are removed first", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const columnIds = board.columns.map((column) => column.id);
        const provider = resolveTasksProvider(true);

        const parent = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Delete parent"
        );
        const child = await provider.createSubtaskRecord(
            parent.id,
            "Delete child"
        );

        await provider.archiveTaskRecords([parent.id, child.id]);

        await expect(provider.deleteTaskRecord(parent.id)).rejects.toThrow(
            "A Parent Task cannot be deleted while Subtasks exist"
        );

        await provider.deleteTaskRecord(child.id);
        await provider.deleteTaskRecord(parent.id);

        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === parent.id)
        ).toBe(false);
        expect(
            getGuestSandbox()!.tasks.some((task) => task.id === child.id)
        ).toBe(false);
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

    it("createTaskLinkRecord adds a relates to link both Tasks can see", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const board = sandbox.boards[0]!;
        const columnIds = board.columns.map((column) => column.id);
        const source = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Link source"
        );
        const target = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Link target"
        );

        const updated = await provider.createTaskLinkRecord(
            source.id,
            target.id,
            "relates_to"
        );

        expect(updated.relatedTasks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "relates_to",
                    otherId: target.id,
                    otherKey: target.key,
                }),
            ])
        );

        const after = getGuestSandbox()!;
        expect(
            after.taskLinks.some(
                (link) =>
                    link.kind === "relates_to" &&
                    link.sourceTaskId === source.id &&
                    link.targetTaskId === target.id
            )
        ).toBe(true);

        const sourceActivity = after.activity.filter(
            (event) => event.taskId === source.id
        );
        const targetActivity = after.activity.filter(
            (event) => event.taskId === target.id
        );
        expect(
            sourceActivity.some((event) =>
                event.metadata.changes.some(
                    (change) =>
                        change.field === "task_link" &&
                        (change.to as { key?: string; kind?: string }).kind ===
                            "relates_to" &&
                        (change.to as { key?: string }).key === target.key
                )
            )
        ).toBe(true);
        expect(
            targetActivity.some((event) =>
                event.metadata.changes.some(
                    (change) =>
                        change.field === "task_link" &&
                        (change.to as { key?: string; kind?: string }).kind ===
                            "relates_to" &&
                        (change.to as { key?: string }).key === source.key
                )
            )
        ).toBe(true);
        expect(
            after.notifications.every(
                (row) => row.taskId !== source.id && row.taskId !== target.id
            )
        ).toBe(true);

        const listed = await provider.fetchBoardTasks(board.id);
        const listedSource = listed.tasks.find((task) => task.id === source.id);
        expect(
            listedSource?.relatedTasks?.some(
                (peer) => peer.otherId === target.id
            )
        ).toBe(true);
    });

    it("deleteTaskLinkRecord removes the relates to link from the session", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const board = sandbox.boards[0]!;
        const columnIds = board.columns.map((column) => column.id);
        const source = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Unlink source"
        );
        const target = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Unlink target"
        );
        await provider.createTaskLinkRecord(source.id, target.id, "relates_to");
        const link = getGuestSandbox()!.taskLinks.find(
            (item) =>
                item.sourceTaskId === source.id &&
                item.targetTaskId === target.id
        )!;

        await provider.deleteTaskLinkRecord(link.id);

        const after = getGuestSandbox()!;
        expect(after.taskLinks.some((item) => item.id === link.id)).toBe(false);
        const listed = await provider.fetchBoardTasks(board.id);
        expect(
            listed.tasks
                .find((task) => task.id === source.id)
                ?.relatedTasks?.some((peer) => peer.otherId === target.id)
        ).toBeFalsy();
        expect(
            after.activity.some((event) =>
                event.metadata.changes.some(
                    (change) =>
                        change.field === "task_link" &&
                        change.to === null &&
                        (change.from as { key?: string }).key === target.key
                )
            )
        ).toBe(true);
    });

    it("createTaskLinkRecord refuses self, Parent↔Subtask, and cross-Project links", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const gitBoard = sandbox.boards.find(
            (board) => board.projectId === sandbox.projects[0]!.id
        )!;
        const otherProjectBoard = sandbox.boards.find(
            (board) => board.projectId !== gitBoard.projectId
        )!;
        const parent = sandbox.tasks.find(
            (task) =>
                task.projectId === gitBoard.projectId &&
                sandbox.tasks.some((child) => child.parentId === task.id)
        )!;
        const child = sandbox.tasks.find(
            (task) => task.parentId === parent.id
        )!;
        const foreign = sandbox.tasks.find(
            (task) => task.projectId === otherProjectBoard.projectId
        )!;

        await expect(
            provider.createTaskLinkRecord(parent.id, parent.id, "relates_to")
        ).rejects.toThrow("A Task cannot relate to itself");
        await expect(
            provider.createTaskLinkRecord(parent.id, child.id, "relates_to")
        ).rejects.toThrow(
            "A Task Link cannot connect a Parent Task and its own Subtask"
        );
        await expect(
            provider.createTaskLinkRecord(parent.id, foreign.id, "relates_to")
        ).rejects.toThrow("Task Links must stay inside the same Project");
    });

    it("createTaskLinkRecord allows relates to across Boards in the same Project", async () => {
        const { getGuestSandbox, startGuestSession, updateGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const board = sandbox.boards[0]!;
        const extraBoardId = "b0000000-0000-4000-8000-000000000099";
        updateGuestSandbox((current) => {
            current.boards.push({
                allowedHeadPatterns: [],
                baseBranch: "main",
                columns: board.columns.map((column) => ({ ...column })),
                defaultTaskType: "task",
                id: extraBoardId,
                name: "Frontend",
                position: 1,
                projectId: board.projectId,
            });
        });

        const provider = resolveTasksProvider(true);
        const source = await provider.createTaskRecord(
            board.projectId,
            board.id,
            board.columns[0]!.id,
            "Same-project source"
        );
        const target = await provider.createTaskRecord(
            board.projectId,
            extraBoardId,
            board.columns[0]!.id,
            "Other-board target"
        );

        const updated = await provider.createTaskLinkRecord(
            source.id,
            target.id,
            "relates_to"
        );
        expect(
            updated.relatedTasks?.some((peer) => peer.otherId === target.id)
        ).toBe(true);
    });

    it("moveTaskToBoard moves a Task and remaps status on another Board", async () => {
        const { getGuestSandbox, startGuestSession, updateGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const sourceBoard = sandbox.boards[0]!;
        const targetBoardId = "b0000000-0000-4000-8000-000000000098";
        updateGuestSandbox((current) => {
            current.boards.push({
                allowedHeadPatterns: [],
                baseBranch: "main",
                columns: sourceBoard.columns.map((column) => ({ ...column })),
                defaultTaskType: "task",
                id: targetBoardId,
                name: "Ops",
                position: 2,
                projectId: sourceBoard.projectId,
            });
        });

        const provider = resolveTasksProvider(true);
        const created = await provider.createTaskRecord(
            sourceBoard.projectId,
            sourceBoard.id,
            "in_progress",
            "Move me"
        );
        updateGuestSandbox((current) => {
            const stored = current.tasks.find((task) => task.id === created.id);
            if (stored) {
                stored.sprintId = "s0000000-0000-4000-8000-000000000001";
                stored.sprintPosition = 0;
            }
        });

        await provider.moveTaskToBoard(created.id, targetBoardId, "todo");

        const sourceTasks = await provider.fetchBoardTasks(sourceBoard.id);
        expect(sourceTasks.tasks.some((task) => task.id === created.id)).toBe(
            false
        );

        const targetTasks = await provider.fetchBoardTasks(targetBoardId);
        const moved = targetTasks.tasks.find((task) => task.id === created.id);
        expect(moved?.boardId).toBe(targetBoardId);
        expect(moved?.status).toBe("todo");
        expect(moved?.sprintId).toBeUndefined();
    });

    it("moveTaskToBoard moves Subtasks when the Parent Task moves", async () => {
        const { getGuestSandbox, startGuestSession, updateGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const sourceBoard = sandbox.boards[0]!;
        const targetBoardId = "b0000000-0000-4000-8000-000000000097";
        updateGuestSandbox((current) => {
            current.boards.push({
                allowedHeadPatterns: [],
                baseBranch: "main",
                columns: sourceBoard.columns.map((column) => ({ ...column })),
                defaultTaskType: "task",
                id: targetBoardId,
                name: "Platform",
                position: 3,
                projectId: sourceBoard.projectId,
            });
        });

        const provider = resolveTasksProvider(true);
        const parent = await provider.createTaskRecord(
            sourceBoard.projectId,
            sourceBoard.id,
            "todo",
            "Parent"
        );
        const child = await provider.createSubtaskRecord(
            parent.id,
            "Child",
            "task"
        );

        await provider.moveTaskToBoard(parent.id, targetBoardId, "in_progress");
        await provider.moveTaskToBoard(child.id, targetBoardId, "todo");

        const targetTasks = await provider.fetchBoardTasks(targetBoardId);
        expect(targetTasks.tasks.some((task) => task.id === parent.id)).toBe(
            true
        );
        expect(targetTasks.tasks.some((task) => task.id === child.id)).toBe(
            true
        );
    });

    it("keeps a blocks Task Link after the blocker moves to another Board", async () => {
        const { getGuestSandbox, startGuestSession, updateGuestSandbox } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const sourceBoard = sandbox.boards[0]!;
        const targetBoardId = "b0000000-0000-4000-8000-000000000096";
        updateGuestSandbox((current) => {
            current.boards.push({
                allowedHeadPatterns: [],
                baseBranch: "main",
                columns: sourceBoard.columns.map((column) => ({ ...column })),
                defaultTaskType: "task",
                id: targetBoardId,
                name: "Support",
                position: 4,
                projectId: sourceBoard.projectId,
            });
        });

        const provider = resolveTasksProvider(true);
        const blocker = await provider.createTaskRecord(
            sourceBoard.projectId,
            sourceBoard.id,
            "todo",
            "Blocker"
        );
        const blocked = await provider.createTaskRecord(
            sourceBoard.projectId,
            sourceBoard.id,
            "todo",
            "Blocked"
        );
        await provider.createTaskLinkRecord(blocker.id, blocked.id, "blocks");

        await provider.moveTaskToBoard(blocker.id, targetBoardId, "todo");

        const listed = await provider.fetchBoardTasks(sourceBoard.id);
        const listedBlocked = listed.tasks.find(
            (task) => task.id === blocked.id
        );
        expect(listedBlocked?.hasOpenBlocker).toBe(true);
        expect(
            listedBlocked?.relatedTasks?.some(
                (peer) =>
                    peer.kind === "blocks" &&
                    peer.direction === "incoming" &&
                    peer.otherId === blocker.id
            )
        ).toBe(true);

        const doneColumn = sourceBoard.columns.find((column) => column.isDone);
        await expect(
            provider.updateTaskRecord(blocked.id, {
                status: doneColumn!.id,
            })
        ).rejects.toThrow(
            "A Task cannot enter Done while an open blocker exists"
        );
    });

    it("createTaskLinkRecord adds a blocks link and refuses a cycle", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const board = sandbox.boards[0]!;
        const columnIds = board.columns.map((column) => column.id);
        const source = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Blocker"
        );
        const target = await provider.createTaskRecord(
            board.projectId,
            board.id,
            columnIds[0]!,
            "Blocked"
        );

        const updated = await provider.createTaskLinkRecord(
            source.id,
            target.id,
            "blocks"
        );
        expect(
            updated.relatedTasks?.some(
                (peer) =>
                    peer.kind === "blocks" &&
                    peer.direction === "outgoing" &&
                    peer.otherId === target.id
            )
        ).toBe(true);

        const listed = await provider.fetchBoardTasks(board.id);
        const listedTarget = listed.tasks.find((task) => task.id === target.id);
        expect(listedTarget?.hasOpenBlocker).toBe(true);

        await expect(
            provider.createTaskLinkRecord(target.id, source.id, "blocks")
        ).rejects.toThrow("A cyclic blocks chain is not allowed");

        expect(
            getGuestSandbox()!.notifications.every(
                (row) => row.taskId !== source.id && row.taskId !== target.id
            )
        ).toBe(true);
    });

    it("refuses moving a blocked Task into Done and allows in-progress", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const provider = resolveTasksProvider(true);
        const blocked = sandbox.tasks.find((task) =>
            sandbox.taskLinks.some(
                (link) =>
                    link.kind === "blocks" && link.targetTaskId === task.id
            )
        )!;
        const board = sandbox.boards.find(
            (item) => item.id === blocked.boardId
        )!;
        const doneColumn = board.columns.find((column) => column.isDone)!;
        const inProgress = board.columns.find(
            (column) => !column.isDone && column.id !== blocked.status
        )!;

        await expect(
            provider.persistTaskMoves(blocked.boardId, [
                { id: blocked.id, position: 0, status: doneColumn.id },
            ])
        ).rejects.toThrow(
            "A Task cannot enter Done while an open blocker exists"
        );

        await provider.persistTaskMoves(blocked.boardId, [
            { id: blocked.id, position: 0, status: inProgress.id },
        ]);
        expect(
            getGuestSandbox()!.tasks.find((task) => task.id === blocked.id)
                ?.status
        ).toBe(inProgress.id);
    });
});
