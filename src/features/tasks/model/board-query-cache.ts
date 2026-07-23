import type { QueryClient } from "@tanstack/react-query";

import type { BoardColumn } from "@/features/boards/model/types";
import type { ProjectLabel } from "@/features/labels/model/types";
import type {
    BoardTasksCache,
    ProjectBoard,
} from "@/features/tasks/api/tasks-api";

import { invalidateBoardColumns } from "@/features/boards/model/invalidate-boards";
import { boardKeys } from "@/features/boards/model/query-keys";
import { labelKeys } from "@/features/labels/model/query-keys";

import { taskKeys } from "./query-keys";

export type { BoardTasksCache } from "@/features/tasks/api/tasks-api";

export type BoardWorkspaceSlice = "columns" | "labels" | "tasks";

export function composeProjectBoard(
    columns: BoardColumn[],
    labels: ProjectLabel[],
    tasksCache: BoardTasksCache
): ProjectBoard {
    return {
        columns,
        labels,
        taskPositions: tasksCache.taskPositions,
        tasks: tasksCache.tasks,
    };
}

export function getBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
    boardId: string
): ProjectBoard | undefined {
    const columns = queryClient.getQueryData<BoardColumn[]>(
        boardKeys.columns(projectId, boardId)
    );
    const labels = queryClient.getQueryData<ProjectLabel[]>(
        labelKeys.project(projectId)
    );
    const tasksCache = queryClient.getQueryData<BoardTasksCache>(
        taskKeys.board(projectId, boardId)
    );

    if (!columns || !labels || !tasksCache) return undefined;
    return composeProjectBoard(columns, labels, tasksCache);
}

export function invalidateBoardWorkspace(
    queryClient: QueryClient,
    projectId: string
) {
    invalidateBoardWorkspaceSlice(queryClient, projectId, "columns");
    invalidateBoardWorkspaceSlice(queryClient, projectId, "labels");
    invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
}

/** Invalidate one workspace slice for a Project (all Boards where keyed by project). */
export function invalidateBoardWorkspaceSlice(
    queryClient: QueryClient,
    projectId: string,
    slice: BoardWorkspaceSlice
) {
    switch (slice) {
        case "columns": {
            invalidateBoardColumns(queryClient, projectId);
            return;
        }
        case "labels": {
            void queryClient.invalidateQueries({
                queryKey: labelKeys.project(projectId),
            });
            return;
        }
        case "tasks": {
            void queryClient.invalidateQueries({
                queryKey: [...taskKeys.all, "board", projectId],
            });
        }
    }
}

export function setBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
    boardId: string,
    updater: (current: ProjectBoard) => ProjectBoard
) {
    const current = getBoardSnapshot(queryClient, projectId, boardId);
    if (!current) return;

    const next = updater(current);
    queryClient.setQueryData(
        boardKeys.columns(projectId, boardId),
        next.columns
    );
    queryClient.setQueryData(labelKeys.project(projectId), next.labels);
    queryClient.setQueryData(taskKeys.board(projectId, boardId), {
        taskPositions: next.taskPositions,
        tasks: next.tasks,
    } satisfies BoardTasksCache);
}
