import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Notification } from "@/features/notifications/model/types";

import { getGuestSandbox, isGuest } from "@/features/guest-mode";
import { fetchTaskNavigation } from "@/features/notifications/api/notifications-api";
import { focusCommentIdFromNotification } from "@/features/notifications/lib/focus-comment-from-notification";
import { useMarkNotificationRead } from "@/features/notifications/model/use-notifications";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { waitForActiveViewTransition } from "@/shared/lib/page-transitions";

export function useOpenNotification() {
    const navigate = useNavigate();
    const parameters = useParams({ strict: false });
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
            /** Runs before navigation (e.g. await notification drawer close). */
            onNavigate?: () => Promise<void> | void;
        }
    ) {
        try {
            // Close the notification drawer first so its exit animation is not
            // stacked under the page view-transition + task drawer open.
            await options?.onNavigate?.();

            const nav = isGuest()
                ? resolveGuestTaskNavigation(notification.taskId)
                : await fetchTaskNavigation({
                      taskId: notification.taskId,
                  });

            const alreadyOnBoard =
                parameters.projectId === nav.projectId &&
                parameters.boardId === nav.boardId;

            if (!alreadyOnBoard) {
                await navigate({
                    params: {
                        boardId: nav.boardId,
                        projectId: nav.projectId,
                    },
                    to: "/projects/$projectId/boards/$boardId",
                });
                // Router resolves navigate when the VT DOM update runs, not when
                // fade/slide CSS finishes — wait so the task drawer opens cleanly.
                await waitForActiveViewTransition();
            }

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

function resolveGuestTaskNavigation(taskId: string): {
    boardId: string;
    projectId: string;
} {
    const sandbox = getGuestSandbox();
    const task = sandbox?.tasks.find((entry) => entry.id === taskId);
    if (!task) {
        throw new Error("Guest task not found");
    }
    return { boardId: task.boardId, projectId: task.projectId };
}
