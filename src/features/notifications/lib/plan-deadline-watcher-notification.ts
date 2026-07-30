import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

/**
 * Call-site seam: Activity deadline diff → Watcher `deadline_change` event.
 * Actor exclusion happens in the RPC.
 */
export function planDeadlineWatcherNotification(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent | undefined {
    const change = activityChanges.find((entry) => entry.field === "deadline");
    if (!change) return undefined;

    const from = normalizeDeadline(change.from);
    const to = normalizeDeadline(change.to);
    if (from === to) return undefined;

    return {
        kind: "deadline_change",
        metadata: { from, source: "app", to },
    };
}

function normalizeDeadline(value: unknown): null | string {
    if (typeof value === "string" && value.length > 0) return value;
    return null;
}
