import type { QueryClient } from "@tanstack/react-query";

import { taskKeys } from "@/features/tasks/model/query-keys";

import { sprintKeys } from "./query-keys";

/**
 * After Sprint membership or lifecycle changes on a Board, refresh Sprint list
 * and Tasks-for-Board via the allowed `sprints → tasks` dependency — not a
 * shared ProjectBoard aggregate.
 */
export function invalidateSprintBoardCaches(
    queryClient: QueryClient,
    projectId: string,
    boardId: string
) {
    void queryClient.invalidateQueries({ queryKey: sprintKeys.board(boardId) });
    void queryClient.invalidateQueries({
        queryKey: taskKeys.board(projectId, boardId),
    });
}
