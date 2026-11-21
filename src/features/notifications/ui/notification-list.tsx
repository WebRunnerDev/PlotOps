import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Notification } from "@/features/notifications/model/types";

import {
    useMarkNotificationRead,
    useMarkNotificationUnread,
} from "@/features/notifications/model/use-notifications";
import { NotificationItem } from "@/features/notifications/ui/notification-item";
import { cn } from "@/shared/lib/utils";

type NotificationListProperties = {
    /** Task currently open in the drawer — its rows get the active style. */
    activeTaskId?: string;
    className?: string;
    items: readonly Notification[];
    onOpen: (notification: Notification) => void;
    /** Project name per row; return undefined to hide it. */
    projectNameFor?: (notification: Notification) => string | undefined;
};

/**
 * Inbox rows, newest first. Read state only restyles a row — it never moves,
 * so marking one read (or opening it) keeps the reader's place.
 */
export function NotificationList({
    activeTaskId,
    className,
    items,
    onOpen,
    projectNameFor,
}: NotificationListProperties) {
    const { t } = useTranslation("common");
    const markRead = useMarkNotificationRead();
    const markUnread = useMarkNotificationUnread();
    const pendingId = markRead.isPending
        ? markRead.variables?.[0]
        : markUnread.isPending
          ? markUnread.variables?.[0]
          : undefined;

    function toggleRead(notification: Notification) {
        const mutation =
            notification.readAt == undefined ? markRead : markUnread;
        mutation.mutate([notification.id], {
            onError: () => {
                toast.error(t("notifications.updateFailed"));
            },
        });
    }

    return (
        <ul className={cn("divide-y divide-border", className)}>
            {items.map((item) => (
                <NotificationItem
                    active={activeTaskId === item.taskId}
                    key={item.id}
                    notification={item}
                    onOpen={() => onOpen(item)}
                    onToggleRead={() => toggleRead(item)}
                    projectName={projectNameFor?.(item)}
                    toggleDisabled={pendingId === item.id}
                />
            ))}
        </ul>
    );
}
