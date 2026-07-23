import type { QueryClient } from "@tanstack/react-query";

import type { BoardColumn } from "@/features/boards";
import type { ProjectLabel } from "@/features/labels";
import type {
    BoardTasksCache,
    ProjectBoard,
} from "@/features/tasks/api/tasks-api";

import { boardKeys, invalidateBoardColumns } from "@/features/boards";
import { labelKeys } from "@/features/labels";

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

/** Optimistic update of the Board Tasks cache only (columns/Labels unchanged). */
export function setTasksCache(
    queryClient: QueryClient,
    projectId: string,
    boardId: string,
    updater: (current: BoardTasksCache) => BoardTasksCache
) {
    const current = queryClient.getQueryData<BoardTasksCache>(
        taskKeys.board(projectId, boardId)
    );
    if (!current) return;
    queryClient.setQueryData(
        taskKeys.board(projectId, boardId),
        updater(current)
    );
}
