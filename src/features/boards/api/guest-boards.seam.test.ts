import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guestBoardsProvider } from "@/features/boards/api/guest-boards";
import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";

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

describe("guest boards provider happy path", () => {
    it("create board / add column / rename / reorder / delete persist", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const projectId = sandbox.projects[0]!.id;
        const provider = resolveBoardsProvider(true);
        expect(provider).toBe(guestBoardsProvider);

        const board = await provider.createBoard(
            projectId,
            "Guest Board",
            "develop"
        );
        expect(board.name).toBe("Guest Board");
        expect(board.baseBranch).toBe("develop");
        expect(board.projectId).toBe(projectId);

        const columnsAfterCreate = await provider.fetchBoardColumns(
            projectId,
            board.id
        );
        expect(columnsAfterCreate.length).toBeGreaterThan(0);

        const columnId = await provider.createBoardColumn(
            projectId,
            board.id,
            "Blocked"
        );
        expect(columnId).toMatch(/^col_/);

        await provider.renameBoardColumn(board.id, columnId, "Waiting");
        const renamed = await provider.fetchBoardColumns(projectId, board.id);
        expect(renamed.find((column) => column.id === columnId)?.name).toBe(
            "Waiting"
        );

        const orderedIds = renamed.map((column) => column.id);
        const reordered = [
            columnId,
            ...orderedIds.filter((id) => id !== columnId),
        ];
        await provider.reorderBoardColumns(board.id, reordered);
        const afterReorder = await provider.fetchBoardColumnIds(board.id);
        expect(afterReorder[0]).toBe(columnId);

        const moveTarget = afterReorder[1]!;
        await provider.deleteBoardColumn(board.id, columnId, moveTarget);
        const afterDelete = await provider.fetchBoardColumnIds(board.id);
        expect(afterDelete).not.toContain(columnId);

        await provider.updateBoard(board.id, { name: "Renamed Guest Board" });
        const updated = await provider.fetchBoard(board.id);
        expect(updated.name).toBe("Renamed Guest Board");

        expect(board.defaultTaskType).toBe("task");
        await provider.updateBoard(board.id, { default_task_type: "bug" });
        const withDefaultType = await provider.fetchBoard(board.id);
        expect(withDefaultType.defaultTaskType).toBe("bug");

        await provider.deleteBoard(board.id);
        const boards = await provider.fetchProjectBoards(projectId);
        expect(boards.some((item) => item.id === board.id)).toBe(false);

        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const after = refreshed.getGuestSandbox()!;
        expect(after.boards.some((item) => item.id === board.id)).toBe(false);
    });
});
