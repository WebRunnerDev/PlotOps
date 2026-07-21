import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchTaskActivity } from "@/features/tasks/api/task-activity-api";
import { taskKeys } from "@/features/tasks/model/query-keys";

export function activityKey(taskId: string) {
    return [...taskKeys.all, "activity", taskId] as const;
}

export function useInvalidateTaskActivity() {
    const queryClient = useQueryClient();

    return (taskId: string) => {
        void queryClient.invalidateQueries({ queryKey: activityKey(taskId) });
    };
}

export function useTaskActivity(taskId: string | undefined, enabled: boolean) {
    return useQuery({
        enabled: Boolean(taskId) && enabled,
        queryFn: async () => {
            const { data, error } = await fetchTaskActivity(taskId!);
            if (error) throw error;
            return data ?? [];
        },
        queryKey: activityKey(taskId!),
    });
}
