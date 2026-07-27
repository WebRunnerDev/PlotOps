import type { TFunction } from "i18next";

import type { Notification } from "@/features/notifications/model/types";

export function formatNotificationContext(
    notification: Notification,
    t: TFunction<"common">
): string {
    if (notification.kind === "assignment") {
        const metadata = notification.metadata as {
            assignee?: { name?: string };
        };
        const name = metadata.assignee?.name;
        if (name) {
            return t("notifications.kinds.assignmentDetail", { name });
        }
        return t("notifications.kinds.assignment");
    }

    const metadata = notification.metadata as {
        from?: { name?: string };
        to?: { name?: string };
    };
    const from = metadata.from?.name;
    const to = metadata.to?.name;
    if (from && to) {
        return t("notifications.kinds.statusChangeDetail", { from, to });
    }
    return t("notifications.kinds.statusChange");
}
