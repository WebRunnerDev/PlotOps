import { useNavigate } from "@tanstack/react-router";

import type { Notification } from "@/features/notifications/model/types";

import { fetchTaskNavigation } from "@/features/notifications/api/notifications-api";
import { focusCommentIdFromNotification } from "@/features/notifications/lib/focus-comment-from-notification";
import { useMarkNotificationRead } from "@/features/notifications/model/use-notifications";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";

export function useOpenNotification() {
    const navigate = useNavigate();
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const markRead = useMarkNotificationRead();

    return async function openNotification(
        notification: Notification,
        options?: {
            onFallback?: () => Promise<void> | void;
            onNavigate?: () => void;
        }
    ) {
        try {
            await markRead.mutateAsync([notification.id]);
        } catch {
            // Still navigate even if mark-read fails.
        }

        try {
            const nav = await fetchTaskNavigation({
                taskId: notification.taskId,
            });
            selectTask(notification.taskId, {
                focusCommentId: focusCommentIdFromNotification(notification),
            });
            options?.onNavigate?.();
            await navigate({
                params: {
                    boardId: nav.boardId,
                    projectId: nav.projectId,
                },
                to: "/projects/$projectId/boards/$boardId",
            });
        } catch {
            await options?.onFallback?.();
        }
    };
}
