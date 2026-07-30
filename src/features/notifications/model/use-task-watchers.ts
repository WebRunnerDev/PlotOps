import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    addTaskWatch,
    fetchTaskWatchers,
    removeTaskWatch,
} from "@/features/notifications/api/notifications-api";
import { notificationsKeys } from "@/features/notifications/model/query-keys";

export function useTaskWatchers(input: { projectId: string; taskId: string }) {
    return useQuery({
        enabled: Boolean(input.taskId && input.projectId),
        gcTime: 5 * 60 * 1000,
        queryFn: () => fetchTaskWatchers(input),
        queryKey: notificationsKeys.taskWatchers({
            projectId: input.projectId,
            taskId: input.taskId,
        }),
        staleTime: 5000,
    });
}

export function useToggleTaskWatch(input: {
    projectId: string;
    taskId: string;
}) {
    const queryClient = useQueryClient();
    const watchersKey = notificationsKeys.taskWatchers({
        projectId: input.projectId,
        taskId: input.taskId,
    });

    return useMutation({
        mutationFn: async (isWatching: boolean) => {
            await (isWatching
                ? removeTaskWatch({ taskId: input.taskId })
                : addTaskWatch({
                      projectId: input.projectId,
                      taskId: input.taskId,
                  }));
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: watchersKey });
        },
    });
}
