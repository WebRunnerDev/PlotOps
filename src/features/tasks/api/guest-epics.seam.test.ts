import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { EPIC_RULE_ERROR } from "@/features/tasks/lib/epic-rules";

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

let store: Map<string, string>;

beforeEach(() => {
    store = stubSessionStorage();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

async function startGuest() {
    const guestMode = await import("@/features/guest-mode");
    guestMode.startGuestSession();
    const sandbox = guestMode.getGuestSandbox()!;
    const epic = sandbox.tasks.find((task) => task.type === "epic")!;
    const board = sandbox.boards.find((item) => item.id === epic.boardId)!;
    return { board, epic, guestMode, provider: resolveTasksProvider(true) };
}

describe("guest Epics (ADR 0031)", () => {
    it("seeds Epics with rollup progress over their Stories", async () => {
        const { epic, provider } = await startGuest();

        const epics = await provider.fetchProjectEpics(epic.projectId);
        const summary = epics.find((item) => item.id === epic.id)!;
        expect(summary.key).toBe(epic.key);
        expect(summary.taskCount).toBeGreaterThan(0);
        expect(summary.doneCount).toBeLessThanOrEqual(summary.taskCount);
    });

    it("creates Epics and Stories in an Epic, with typed keys", async () => {
        const { board, provider } = await startGuest();
        const firstColumn = board.columns[0]!.id;

        const created = await provider.createTaskRecord(
            board.projectId,
            board.id,
            firstColumn,
            "Payments",
            "epic",
            undefined,
            { epicColor: "orange" }
        );
        expect(created.key).toMatch(/^EPIC-\d+$/);
        expect(created.epicColor).toBe("orange");

        const story = await provider.createTaskRecord(
            board.projectId,
            board.id,
            firstColumn,
            "Pay by card",
            "story",
            undefined,
            { epicId: created.id }
        );
        expect(story.key).toMatch(/^STORY-\d+$/);
        expect(story.epicId).toBe(created.id);

        const epics = await provider.fetchProjectEpics(board.projectId);
        const summary = epics.find((item) => item.id === created.id);
        expect(summary?.taskCount).toBe(1);
    });

    it("refuses Subtasks under an Epic and Epics in a Sprint", async () => {
        const { epic, guestMode, provider } = await startGuest();

        await expect(
            provider.createSubtaskRecord(epic.id, "Nope")
        ).rejects.toThrow(EPIC_RULE_ERROR.epic_subtasks);

        const inSprint = guestMode
            .getGuestSandbox()!
            .tasks.find(
                (task) =>
                    task.sprintId !== undefined &&
                    task.parentId === undefined &&
                    task.projectId === epic.projectId
            )!;
        await expect(
            provider.updateTaskDetails(inSprint.id, { task_type: "epic" })
        ).rejects.toThrow(EPIC_RULE_ERROR.epic_in_sprint);
    });

    it("clears membership when the Epic is deleted", async () => {
        const { epic, guestMode, provider } = await startGuest();
        const memberIds = guestMode
            .getGuestSandbox()!
            .tasks.filter((task) => task.epicId === epic.id)
            .map((task) => task.id);
        expect(memberIds.length).toBeGreaterThan(0);

        await provider.archiveTaskRecord(epic.id);
        await provider.deleteTaskRecord(epic.id);

        const after = guestMode.getGuestSandbox()!;
        for (const id of memberIds) {
            expect(after.tasks.find((task) => task.id === id)?.epicId).toBe(
                undefined
            );
        }
    });

    it("migrates sessions saved with the legacy `feature` type", async () => {
        const { guestMode } = await startGuest();
        const [key, raw] = [...store.entries()][0]!;
        const legacy = raw.replaceAll('"type":"story"', '"type":"feature"');
        store.set(key, legacy);

        const sandbox = guestMode.getGuestSandbox()!;
        expect(sandbox.tasks.some((task) => task.type === "story")).toBe(true);
        expect(
            sandbox.tasks.some((task) => (task.type as string) === "feature")
        ).toBe(false);
    });
});
