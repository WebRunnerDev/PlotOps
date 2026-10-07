import { useQuery } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { taskKeys } from "@/features/tasks/model/query-keys";

/** Team Tasks — active non-Epic Tasks across every Project of the Team. */
export function useTeamTasks(teamId: string, enabled = true) {
    const provider = resolveTasksProvider(isGuest());

    return useQuery({
        enabled: Boolean(teamId) && enabled,
        queryFn: () => provider.fetchTeamTasks(teamId),
        queryKey: taskKeys.team(teamId),
    });
}
