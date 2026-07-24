import { useQuery } from "@tanstack/react-query";

import { fetchProjectTasks } from "@/features/tasks/api/tasks-api";
import { taskKeys } from "@/features/tasks/model/query-keys";

/** Project-scoped active Tasks (all Boards) — not Board-local cache. */
export function useProjectTasks(projectId: string, enabled = true) {
    return useQuery({
        enabled: Boolean(projectId) && enabled,
        queryFn: () => fetchProjectTasks(projectId),
        queryKey: taskKeys.project(projectId),
    });
}
