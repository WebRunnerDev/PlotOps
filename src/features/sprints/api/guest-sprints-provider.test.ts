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

describe("guestSprintsProvider happy path", () => {
    it("lists board sprints from the sandbox without remote calls", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const boardId = getGuestSandbox()!.boards[0]!.id;

        const sprints = await guestSprintsProvider.fetchBoardSprints(boardId);
        expect(sprints.length).toBeGreaterThan(0);
        expect(sprints.every((sprint) => sprint.boardId === boardId)).toBe(
            true
        );
    });

    it("assigns tasks to a sprint and persists membership in the sandbox", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const draft = sandbox.sprints.find(
            (sprint) => sprint.state === "draft"
        );
        const backlogTask = sandbox.tasks.find((task) => !task.sprintId);
        expect(draft).toBeTruthy();
        expect(backlogTask).toBeTruthy();

        const activityBefore = sandbox.activity.length;
        const notificationsBefore = sandbox.notifications.length;

        await guestSprintsProvider.assignTaskToSprint(
            backlogTask!.id,
            draft!.id,
            0
        );

        const after = getGuestSandbox()!;
        const moved = after.tasks.find((task) => task.id === backlogTask!.id);
        expect(moved?.sprintId).toBe(draft!.id);
        expect(moved?.sprintPosition).toBe(0);
        expect(after.activity.length).toBe(activityBefore);
        expect(after.notifications.length).toBe(notificationsBefore);
    });

    it("creates a draft and starts it when the board has no other active sprint", async () => {
        const { getGuestSandbox, startGuestSession, writeGuestSandbox } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const boardId = sandbox.boards[0]!.id;
        const projectId = sandbox.projects[0]!.id;

        // Seed has an active sprint — close path prep: cancel active first so
        // Draft→Active happy path can start a new draft.
        const active = sandbox.sprints.find(
            (sprint) => sprint.boardId === boardId && sprint.state === "active"
        );
        expect(active).toBeTruthy();
        await guestSprintsProvider.cancelSprint(active!.id);

        const draft = await guestSprintsProvider.createDraftSprint(
            boardId,
            projectId,
            "Sprint Local Demo",
            "Prove Draft/Active locally"
        );
        expect(draft.state).toBe("draft");

        const task = getGuestSandbox()!.tasks.find(
            (item) => item.boardId === boardId
        )!;
        await guestSprintsProvider.assignTaskToSprint(task.id, draft.id, 0);

        const started = await guestSprintsProvider.startSprint(
            draft.id,
            "2026-08-05",
            "2026-08-18"
        );

        expect(started.state).toBe("active");
        expect(started.startsOn).toBe("2026-08-05");
        expect(started.endsOn).toBe("2026-08-18");
        expect(started.committedTaskIds).toContain(task.id);

        const persisted = getGuestSandbox()!.sprints.find(
            (sprint) => sprint.id === draft.id
        );
        expect(persisted?.state).toBe("active");
        expect(persisted?.committedTaskIds).toContain(task.id);

        // Refresh-style re-read from store still sees the mutation.
        writeGuestSandbox(getGuestSandbox()!);
        const reread = await guestSprintsProvider.fetchBoardSprints(boardId);
        expect(reread.find((sprint) => sprint.id === draft.id)?.state).toBe(
            "active"
        );
    });

    it("closes an active sprint with different carryover Drafts per incomplete task", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const boardId = sandbox.boards[0]!.id;
        const projectId = sandbox.projects[0]!.id;

        const active = sandbox.sprints.find(
            (sprint) => sprint.boardId === boardId && sprint.state === "active"
        );
        expect(active).toBeTruthy();

        const members = sandbox.tasks.filter(
            (task) => task.sprintId === active!.id
        );
        expect(members.length).toBeGreaterThanOrEqual(2);

        const draftA = await guestSprintsProvider.createDraftSprint(
            boardId,
            projectId,
            "Carry A"
        );
        const draftB = await guestSprintsProvider.createDraftSprint(
            boardId,
            projectId,
            "Carry B"
        );

        const [taskA, taskB] = members;
        await guestSprintsProvider.closeSprint(active!.id, [], {
            [taskA!.id]: draftA.id,
            [taskB!.id]: draftB.id,
        });

        const after = getGuestSandbox()!;
        expect(
            after.sprints.find((sprint) => sprint.id === active!.id)?.state
        ).toBe("closed");
        expect(
            after.tasks.find((task) => task.id === taskA!.id)?.sprintId
        ).toBe(draftA.id);
        expect(
            after.tasks.find((task) => task.id === taskB!.id)?.sprintId
        ).toBe(draftB.id);
    });

    it("keeps completed Tasks on the Closed Sprint and only carries incomplete", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const boardId = sandbox.boards[0]!.id;
        const projectId = sandbox.projects[0]!.id;
        const active = sandbox.sprints.find(
            (sprint) => sprint.boardId === boardId && sprint.state === "active"
        )!;
        const members = sandbox.tasks.filter(
            (task) => task.sprintId === active.id
        );
        expect(members.length).toBeGreaterThanOrEqual(2);

        const [doneTask, incompleteTask] = members;
        const draft = await guestSprintsProvider.createDraftSprint(
            boardId,
            projectId,
            "Next"
        );

        await guestSprintsProvider.closeSprint(active.id, [doneTask!.id], {
            [incompleteTask!.id]: draft.id,
        });

        const after = getGuestSandbox()!;
        const closed = after.sprints.find((sprint) => sprint.id === active.id);
        expect(closed?.state).toBe("closed");
        expect(closed?.completedTaskIds).toEqual([doneTask!.id]);
        expect(
            after.tasks.find((task) => task.id === doneTask!.id)?.sprintId
        ).toBe(active.id);
        expect(
            after.tasks.find((task) => task.id === incompleteTask!.id)?.sprintId
        ).toBe(draft.id);
    });

    it("releases Closed Sprint members to Backlog when history is deleted", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const boardId = sandbox.boards[0]!.id;
        const active = sandbox.sprints.find(
            (sprint) => sprint.boardId === boardId && sprint.state === "active"
        )!;
        const memberIds = sandbox.tasks
            .filter((task) => task.sprintId === active.id)
            .map((task) => task.id);
        expect(memberIds.length).toBeGreaterThan(0);

        await guestSprintsProvider.closeSprint(active.id, memberIds, {});
        await guestSprintsProvider.deletePastSprint(active.id);

        const after = getGuestSandbox()!;
        expect(after.sprints.some((sprint) => sprint.id === active.id)).toBe(
            false
        );
        for (const taskId of memberIds) {
            expect(
                after.tasks.find((task) => task.id === taskId)?.sprintId
            ).toBeUndefined();
        }
    });

    it("returns no sprint events and does not grow activity on mutations", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");
        const { guestSprintsProvider } =
            await import("@/features/sprints/api/guest-sprints-provider");

        startGuestSession();
        const draft = getGuestSandbox()!.sprints.find(
            (sprint) => sprint.state === "draft"
        )!;
        const activityBefore = getGuestSandbox()!.activity.length;

        const events = await guestSprintsProvider.fetchSprintEvents(draft.id);
        expect(events).toEqual([]);

        await guestSprintsProvider.updateDraftSprint(draft.id, {
            name: "Renamed draft",
        });

        expect(getGuestSandbox()!.activity.length).toBe(activityBefore);
        expect(
            getGuestSandbox()!.sprints.find((sprint) => sprint.id === draft.id)
                ?.name
        ).toBe("Renamed draft");
    });
});
