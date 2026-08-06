import { useQuery } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { taskKeys } from "@/features/tasks/model/query-keys";

/** Project-scoped active Tasks (all Boards) — not Board-local cache. */
export function useProjectTasks(projectId: string, enabled = true) {
    const provider = resolveTasksProvider(isGuest());

    return useQuery({
        enabled: Boolean(projectId) && enabled,
        queryFn: () => provider.fetchProjectTasks(projectId),
        queryKey: taskKeys.project(projectId),
    });
}
