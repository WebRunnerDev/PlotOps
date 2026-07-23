import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
    invalidateBoardColumns,
    invalidateProjectBoards,
} from "./invalidate-boards";
import { boardKeys } from "./query-keys";

const projectId = "proj_1";
const boardId = "board_1";

/** Sibling-module key shapes — literals so boards stays a leaf (ADR-0009). */
const labelsProjectKey = ["labels", "project", projectId] as const;
const tasksBoardKey = ["tasks", "board", projectId, boardId] as const;

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("boards feature query seam", () => {
    it("owns Board list and columns keys distinct from Labels and Board Tasks", () => {
        expect(boardKeys.list(projectId)).toEqual([
            "boards",
            "list",
            projectId,
        ]);
        expect(boardKeys.columns(projectId, boardId)).toEqual([
            "boards",
            "columns",
            projectId,
            boardId,
        ]);

        const keys = [
            boardKeys.list(projectId).join("/"),
            boardKeys.columns(projectId, boardId).join("/"),
            labelsProjectKey.join("/"),
            tasksBoardKey.join("/"),
        ];
        expect(new Set(keys).size).toBe(4);
    });

    it("column invalidation marks only the columns query stale", () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        const listKey = boardKeys.list(projectId);
        const columnsKey = boardKeys.columns(projectId, boardId);

        queryClient.setQueryData(listKey, [
            {
                allowedHeadPatterns: [],
                baseBranch: "main",
                id: boardId,
                name: "Main",
                position: 0,
                projectId,
            },
        ]);
        queryClient.setQueryData(columnsKey, [{ id: "todo", name: "Todo" }]);
        queryClient.setQueryData(labelsProjectKey, []);
        queryClient.setQueryData(tasksBoardKey, {
            taskPositions: new Map(),
            tasks: [],
        });

        invalidateBoardColumns(queryClient, projectId);

        expect(queryClient.getQueryState(columnsKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
        expect(queryClient.getQueryState(labelsProjectKey)?.isInvalidated).toBe(
            false
        );
        expect(queryClient.getQueryState(tasksBoardKey)?.isInvalidated).toBe(
            false
        );
    });

    it("Board list invalidation marks only the list query stale", () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        const listKey = boardKeys.list(projectId);
        const columnsKey = boardKeys.columns(projectId, boardId);

        queryClient.setQueryData(listKey, []);
        queryClient.setQueryData(columnsKey, [{ id: "todo", name: "Todo" }]);
        queryClient.setQueryData(tasksBoardKey, {
            taskPositions: new Map(),
            tasks: [],
        });

        invalidateProjectBoards(queryClient, projectId);

        expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(columnsKey)?.isInvalidated).toBe(
            false
        );
        expect(queryClient.getQueryState(tasksBoardKey)?.isInvalidated).toBe(
            false
        );
    });
});

describe("boards settings seam", () => {
    it("Board switcher and Board settings work without BoardProvider", () => {
        const switcher = readFileSync(
            path.join(dirname, "../ui/board-switcher.tsx"),
            "utf8"
        );
        const settings = readFileSync(
            path.join(dirname, "../ui/project-boards-settings.tsx"),
            "utf8"
        );

        for (const source of [switcher, settings]) {
            expect(source).not.toMatch(/\bBoardProvider\b/);
            expect(source).not.toMatch(/\buseBoard\b/);
            expect(source).not.toMatch(/\buseBoardContext\b/);
        }
    });
});
