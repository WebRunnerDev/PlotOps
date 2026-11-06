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

        const board = await provider.createBoard(projectId, "Guest Board", {
            baseBranch: "develop",
            isDevelopment: true,
        });
        expect(board.name).toBe("Guest Board");
        expect(board.baseBranch).toBe("develop");
        expect(board.isDevelopment).toBe(true);
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

        expect(board.autoAssignToCreator).toBe(false);
        await provider.updateBoard(board.id, {
            auto_assign_to_creator: true,
        });
        const withAutoAssign = await provider.fetchBoard(board.id);
        expect(withAutoAssign.autoAssignToCreator).toBe(true);

        await provider.deleteBoard(board.id);
        const boards = await provider.fetchProjectBoards(projectId);
        expect(boards.some((item) => item.id === board.id)).toBe(false);

        vi.resetModules();
        const refreshed = await import("@/features/guest-mode");
        const after = refreshed.getGuestSandbox()!;
        expect(after.boards.some((item) => item.id === board.id)).toBe(false);
    });

    it("create and clear base branch keep null when the Board is not for development", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const projectId = sandbox.projects[0]!.id;
        const provider = resolveBoardsProvider(true);

        const board = await provider.createBoard(projectId, "Ops Board", {
            isDevelopment: false,
        });
        expect(board.isDevelopment).toBe(false);
        expect(board.baseBranch).toBeNull();
        expect(board.allowedHeadPatterns).toEqual([]);

        const [web, api] = sandbox.projects[0]!.repositories;
        await provider.updateBoard(board.id, {
            is_development: true,
            repository_base_branches: [
                { baseBranch: "release", repositoryId: api!.id },
            ],
        });
        const asDevelopment = await provider.fetchBoard(board.id);
        expect(asDevelopment.isDevelopment).toBe(true);
        // Seeded from each Repository's default, then the given row applied.
        expect(asDevelopment.repositoryBaseBranches).toEqual([
            { baseBranch: web!.defaultBranch, repositoryId: web!.id },
            { baseBranch: "release", repositoryId: api!.id },
        ]);

        await provider.updateBoard(board.id, {
            allowed_head_patterns: ["feature/*"],
            is_development: false,
        });
        const asOps = await provider.fetchBoard(board.id);
        expect(asOps.isDevelopment).toBe(false);
        expect(asOps.baseBranch).toBeNull();
        expect(asOps.allowedHeadPatterns).toEqual([]);
    });

    it("creates a Development Board with a Base branch per Repository", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const project = getGuestSandbox()!.projects[0]!;
        const [web, api] = project.repositories;
        const provider = resolveBoardsProvider(true);

        const board = await provider.createBoard(project.id, "Release", {
            isDevelopment: true,
            repositoryBaseBranches: [
                { baseBranch: "release/web", repositoryId: web!.id },
            ],
        });

        expect(board.repositoryBaseBranches).toEqual([
            { baseBranch: "release/web", repositoryId: web!.id },
            { baseBranch: api!.defaultBranch, repositoryId: api!.id },
        ]);
    });

    it("merge target defaults to last column and falls back to none when its column is deleted", async () => {
        const { getGuestSandbox, startGuestSession } =
            await import("@/features/guest-mode");

        startGuestSession();
        const sandbox = getGuestSandbox()!;
        const projectId = sandbox.projects[0]!.id;
        const provider = resolveBoardsProvider(true);

        const seeded = await provider.fetchProjectBoards(projectId);
        expect(seeded.map((item) => item.mergeTargetMode)).toEqual([
            "last_column",
        ]);

        const board = await provider.createBoard(projectId, "Dev Board", {
            baseBranch: "main",
            isDevelopment: true,
        });
        expect(board.mergeTargetMode).toBe("last_column");
        expect(board.mergeTargetColumnId).toBeNull();

        const qa = await provider.createBoardColumn(projectId, board.id, "QA");
        await provider.updateBoard(board.id, {
            merge_target_column_id: qa,
            merge_target_mode: "column",
        });
        const targeted = await provider.fetchBoard(board.id);
        expect(targeted.mergeTargetMode).toBe("column");
        expect(targeted.mergeTargetColumnId).toBe(qa);

        await expect(
            provider.updateBoard(board.id, {
                merge_target_column_id: "missing",
                merge_target_mode: "column",
            })
        ).rejects.toThrow("Merge target column not found");

        await provider.deleteBoardColumn(board.id, qa);
        const afterDelete = await provider.fetchBoard(board.id);
        expect(afterDelete.mergeTargetMode).toBe("none");
        expect(afterDelete.mergeTargetColumnId).toBeNull();

        await provider.updateBoard(board.id, {
            merge_target_mode: "last_column",
        });
        const reset = await provider.fetchBoard(board.id);
        expect(reset.mergeTargetMode).toBe("last_column");
    });
});
