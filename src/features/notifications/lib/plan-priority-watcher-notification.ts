import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

/**
 * Call-site seam: Activity priority diff → Watcher `priority_change` event.
 * Actor exclusion happens in the RPC.
 */
export function planPriorityWatcherNotification(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent | undefined {
    const change = activityChanges.find((entry) => entry.field === "priority");
    if (!change) return undefined;

    const from = normalizePriority(change.from);
    const to = normalizePriority(change.to);
    if (from === to) return undefined;

    return {
        kind: "priority_change",
        metadata: { from, source: "app", to },
    };
}

function normalizePriority(value: unknown): string {
    if (typeof value === "string" && value.length > 0) return value;
    return "none";
}
