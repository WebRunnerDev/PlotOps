import type { QueryClient } from "@tanstack/react-query";

import type { BoardTasksCache } from "@/features/tasks/api/tasks-api";
import type { Task } from "@/features/tasks/model/types";

import { taskKeys } from "@/features/tasks/model/query-keys";

/** Board id for a Task already in Project or Board query caches. */
export function resolveCachedTaskBoardId(
    queryClient: QueryClient,
    projectId: string,
    taskId: string
): string | undefined {
    const projectLists: Array<Task[] | undefined> = [
        queryClient.getQueryData<Task[]>(taskKeys.project(projectId, true)),
        queryClient.getQueryData<Task[]>(taskKeys.project(projectId, false)),
    ];
    for (const list of projectLists) {
        const boardId = list?.find((task) => task.id === taskId)?.boardId;
        if (boardId) return boardId;
    }

    for (const [, cache] of queryClient.getQueriesData<BoardTasksCache>({
        queryKey: [...taskKeys.all, "board", projectId],
    })) {
        const boardId = cache?.tasks.find(
            (task) => task.id === taskId
        )?.boardId;
        if (boardId) return boardId;
    }

    return undefined;
}
