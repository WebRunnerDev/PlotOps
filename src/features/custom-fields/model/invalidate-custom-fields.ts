import type { QueryClient } from "@tanstack/react-query";

import { customFieldKeys } from "./query-keys";

/** Refresh Settings usage list for a Project. */
export function invalidateCustomFieldValueUsage(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: customFieldKeys.valueUsage(projectId),
    });
}

/** Refresh Project custom field definitions. */
export function invalidateProjectCustomFields(
    queryClient: QueryClient,
    projectId: string
) {
    void queryClient.invalidateQueries({
        queryKey: customFieldKeys.project(projectId),
    });
}

/** Refresh stored values for one Task. */
export function invalidateTaskCustomFieldValues(
    queryClient: QueryClient,
    taskId: string
) {
    void queryClient.invalidateQueries({
        queryKey: customFieldKeys.taskValues(taskId),
    });
}
