import { useQuery } from "@tanstack/react-query";

import { fetchArchivedTasks } from "@/features/tasks/api/tasks-api";
import { taskKeys } from "@/features/tasks/model/query-keys";

export function useArchivedTasks(
    projectId: string,
    boardId: string,
    enabled = true,
) {
    return useQuery({
        enabled: Boolean(projectId && boardId) && enabled,
        queryFn: () => fetchArchivedTasks(boardId),
        queryKey: taskKeys.archived(projectId, boardId),
    });
}
