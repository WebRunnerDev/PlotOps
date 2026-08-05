import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isGuest } from "@/features/guest-mode";
import {
    fetchGuestTaskWatchers,
    setGuestTaskWatch,
} from "@/features/notifications/api/guest-task-watchers";
import {
    addTaskWatch,
    fetchTaskWatchers,
    removeTaskWatch,
} from "@/features/notifications/api/notifications-api";
import { notificationsKeys } from "@/features/notifications/model/query-keys";

export function useTaskWatchers(input: { projectId: string; taskId: string }) {
    const guest = isGuest();

    return useQuery({
        enabled: Boolean(input.taskId && input.projectId),
        gcTime: 5 * 60 * 1000,
        queryFn: () =>
            guest
                ? fetchGuestTaskWatchers({ taskId: input.taskId })
                : fetchTaskWatchers(input),
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
    const guest = isGuest();
    const watchersKey = notificationsKeys.taskWatchers({
        projectId: input.projectId,
        taskId: input.taskId,
    });

    return useMutation({
        mutationFn: async (isWatching: boolean) => {
            if (guest) {
                setGuestTaskWatch({
                    taskId: input.taskId,
                    watching: !isWatching,
                });
                return;
            }
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
