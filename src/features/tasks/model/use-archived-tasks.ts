import { useQuery } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { taskKeys } from "@/features/tasks/model/query-keys";

export function useArchivedTasks(
    projectId: string,
    boardId: string,
    enabled = true
) {
    const provider = resolveTasksProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId && boardId) && enabled,
        queryFn: () => provider.fetchArchivedTasks(boardId),
        queryKey: taskKeys.archived(projectId, boardId),
    });
}
