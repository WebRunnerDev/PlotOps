import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

/**
 * Call-site seam: Activity title diff → Watcher `title_change` event.
 * Actor exclusion happens in the RPC.
 */
export function planTitleWatcherNotification(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent | undefined {
    const change = activityChanges.find((entry) => entry.field === "title");
    if (!change) return undefined;

    const from = normalizeTitle(change.from);
    const to = normalizeTitle(change.to);
    if (from === to) return undefined;

    return {
        kind: "title_change",
        metadata: { from, source: "app", to },
    };
}

function normalizeTitle(value: unknown): string {
    return typeof value === "string" ? value : "";
}
