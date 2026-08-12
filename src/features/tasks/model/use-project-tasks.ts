import { useQuery } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { taskKeys } from "@/features/tasks/model/query-keys";

type UseProjectTasksOptions = {
    includeArchived?: boolean;
};

/** Project-scoped Tasks (all Boards) — not Board-local cache. */
export function useProjectTasks(
    projectId: string,
    enabled = true,
    options?: UseProjectTasksOptions
) {
    const provider = resolveTasksProvider(isGuest());
    const includeArchived = options?.includeArchived === true;

    return useQuery({
        enabled: Boolean(projectId) && enabled,
        queryFn: () =>
            provider.fetchProjectTasks(projectId, { includeArchived }),
        queryKey: taskKeys.project(projectId, includeArchived),
    });
}
