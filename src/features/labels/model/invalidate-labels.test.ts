import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { boardKeys } from "@/features/boards";
import { taskKeys } from "@/features/tasks";

import { invalidateProjectLabels } from "./invalidate-labels";
import { labelKeys } from "./query-keys";

const projectId = "proj_1";
const boardId = "board_1";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("labels feature query seam", () => {
    it("owns a project Labels key distinct from Board columns and Board Tasks", () => {
        expect(labelKeys.project(projectId)).toEqual([
            "labels",
            "project",
            projectId,
        ]);
        expect(boardKeys.columns(projectId, boardId)).toEqual([
            "boards",
            "columns",
            projectId,
            boardId,
        ]);
        expect(taskKeys.board(projectId, boardId)).toEqual([
            "tasks",
            "board",
            projectId,
            boardId,
        ]);

        const keys = [
            labelKeys.project(projectId).join("/"),
            boardKeys.columns(projectId, boardId).join("/"),
            taskKeys.board(projectId, boardId).join("/"),
        ];
        expect(new Set(keys).size).toBe(3);
    });

    it("Label mutation invalidation marks only the Labels query stale", () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        const labelsKey = labelKeys.project(projectId);
        const columnsKey = boardKeys.columns(projectId, boardId);
        const tasksKey = taskKeys.board(projectId, boardId);

        queryClient.setQueryData(labelsKey, [
            {
                color: "blue",
                id: "label_1",
                name: "Bug",
                projectId,
            },
        ]);
        queryClient.setQueryData(columnsKey, [{ id: "todo", name: "Todo" }]);
        queryClient.setQueryData(tasksKey, {
            taskPositions: new Map(),
            tasks: [],
        });

        invalidateProjectLabels(queryClient, projectId);

        expect(queryClient.getQueryState(labelsKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(columnsKey)?.isInvalidated).toBe(
            false
        );
        expect(queryClient.getQueryState(tasksKey)?.isInvalidated).toBe(false);
    });
});

describe("labels settings seam", () => {
    it("ProjectLabelsSettings works without BoardProvider", () => {
        const source = readFileSync(
            path.join(dirname, "../ui/project-labels-settings.tsx"),
            "utf8"
        );

        expect(source).not.toMatch(/\bBoardProvider\b/);
        expect(source).not.toMatch(/\buseBoard\b/);
        expect(source).not.toMatch(/\buseBoardContext\b/);
    });
});
