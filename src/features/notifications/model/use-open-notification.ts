import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Notification } from "@/features/notifications/model/types";

import { fetchTaskNavigation } from "@/features/notifications/api/notifications-api";
import { focusCommentIdFromNotification } from "@/features/notifications/lib/focus-comment-from-notification";
import { useMarkNotificationRead } from "@/features/notifications/model/use-notifications";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";

export function useOpenNotification() {
    const navigate = useNavigate();
    const { t } = useTranslation("common");
    const clearSelectedTask = useTasksUiStore(
        (state) => state.clearSelectedTask
    );
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
            const nav = await fetchTaskNavigation({
                taskId: notification.taskId,
            });
            options?.onNavigate?.();
            await navigate({
                params: {
                    boardId: nav.boardId,
                    projectId: nav.projectId,
                },
                to: "/projects/$projectId/boards/$boardId",
            });
            selectTask(notification.taskId, {
                focusCommentId: focusCommentIdFromNotification(notification),
            });

            try {
                await markRead.mutateAsync([notification.id]);
            } catch {
                // Navigation succeeded; unread badge may lag until next refetch.
            }
        } catch {
            clearSelectedTask();
            toast.error(t("notifications.openFailed"));
            try {
                await options?.onFallback?.();
            } catch {
                // Fallback navigate also failed — toast already shown.
            }
        }
    };
}
