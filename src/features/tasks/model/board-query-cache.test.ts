import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { BoardColumn } from "@/features/boards";
import type { ProjectLabel } from "@/features/labels";
import type { Task } from "@/features/tasks";

import { boardKeys } from "@/features/boards";
import { labelKeys } from "@/features/labels";
import { taskKeys } from "@/features/tasks";

import {
    composeProjectBoard,
    getBoardSnapshot,
    invalidateBoardWorkspaceSlice,
    setTasksCache,
} from "./board-query-cache";

const projectId = "proj_1";
const boardId = "board_1";

const columns: BoardColumn[] = [
    { id: "todo", name: "Todo" },
    { id: "done", name: "Done" },
];

const labels: ProjectLabel[] = [
    {
        color: "blue",
        id: "label_1",
        name: "Bug",
        projectId,
    },
];

const tasks: Task[] = [
    {
        boardId,
        id: "task_1",
        key: "TASK-1",
        labelIds: ["label_1"],
        status: "todo",
        title: "Ship split",
        type: "task",
    },
];

describe("board workspace query cache seam", () => {
    it("keeps columns, Labels, and Tasks under distinct query keys", () => {
        expect(boardKeys.columns(projectId, boardId)).toEqual([
            "boards",
            "columns",
            projectId,
            boardId,
        ]);
        expect(labelKeys.project(projectId)).toEqual([
            "labels",
            "project",
            projectId,
        ]);
        expect(taskKeys.board(projectId, boardId)).toEqual([
            "tasks",
            "board",
            projectId,
            boardId,
        ]);

        const keys = [
            boardKeys.columns(projectId, boardId).join("/"),
            labelKeys.project(projectId).join("/"),
            taskKeys.board(projectId, boardId).join("/"),
        ];
        expect(new Set(keys).size).toBe(3);
    });

    it("composes a ProjectBoard façade from the three slices", () => {
        const taskPositions = new Map([["task_1", 0]]);
        const board = composeProjectBoard(columns, labels, {
            taskPositions,
            tasks,
        });

        expect(board.columns).toBe(columns);
        expect(board.labels).toBe(labels);
        expect(board.tasks).toBe(tasks);
        expect(board.taskPositions.get("task_1")).toBe(0);
    });

    it("invalidates one slice without clearing the others", async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        const columnsKey = boardKeys.columns(projectId, boardId);
        const labelsKey = labelKeys.project(projectId);
        const tasksKey = taskKeys.board(projectId, boardId);

        queryClient.setQueryData(columnsKey, columns);
        queryClient.setQueryData(labelsKey, labels);
        queryClient.setQueryData(tasksKey, {
            taskPositions: new Map([["task_1", 0]]),
            tasks,
        });

        expect(
            getBoardSnapshot(queryClient, projectId, boardId)?.tasks
        ).toHaveLength(1);

        invalidateBoardWorkspaceSlice(queryClient, projectId, "labels");

        expect(queryClient.getQueryState(columnsKey)?.isInvalidated).toBe(
            false
        );
        expect(queryClient.getQueryState(labelsKey)?.isInvalidated).toBe(true);
        expect(queryClient.getQueryState(tasksKey)?.isInvalidated).toBe(false);

        // Cached data remains until refetch — only the labels slice is marked stale
        expect(queryClient.getQueryData(columnsKey)).toEqual(columns);
        expect(queryClient.getQueryData(tasksKey)).toMatchObject({ tasks });
    });

    it("writes optimistic Task updates into the tasks cache only", () => {
        const queryClient = new QueryClient();

        queryClient.setQueryData(
            boardKeys.columns(projectId, boardId),
            columns
        );
        queryClient.setQueryData(labelKeys.project(projectId), labels);
        queryClient.setQueryData(taskKeys.board(projectId, boardId), {
            taskPositions: new Map([["task_1", 0]]),
            tasks,
        });

        setTasksCache(queryClient, projectId, boardId, (current) => ({
            ...current,
            tasks: current.tasks.map((task) =>
                task.id === "task_1"
                    ? { ...task, status: "done" as const }
                    : task
            ),
        }));

        const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
        expect(snapshot?.tasks[0]?.status).toBe("done");
        expect(
            queryClient.getQueryData<typeof columns>(
                boardKeys.columns(projectId, boardId)
            )
        ).toEqual(columns);
        expect(queryClient.getQueryData(labelKeys.project(projectId))).toEqual(
            labels
        );
    });
});
