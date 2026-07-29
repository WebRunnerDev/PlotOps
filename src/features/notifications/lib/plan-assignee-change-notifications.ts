import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

type IdName = { id: string; name: string };

/**
 * Call-site seam: Activity assignee diff → always-on assignment + Watcher
 * `assignee_change`. Clear Assignee plans nothing. Actor exclusion and
 * always-on/Watcher dedupe happen in `create_task_notifications`.
 */
export function planAssigneeChangeNotifications(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent[] {
    const change = activityChanges.find((entry) => entry.field === "assignee");
    if (!change) return [];

    const to = asIdName(change.to);
    if (!to) return [];

    const previousAssignee = asIdName(change.from) ?? null;
    const metadata = {
        assignee: to,
        previousAssignee,
        source: "app" as const,
    };

    return [
        {
            kind: "assignment",
            metadata,
            recipientId: to.id,
        },
        {
            kind: "assignee_change",
            metadata,
        },
    ];
}

function asIdName(value: unknown): IdName | undefined {
    if (!value || typeof value !== "object") return undefined;
    const snapshot = value as { id?: unknown; name?: unknown };
    if (typeof snapshot.id !== "string" || typeof snapshot.name !== "string") {
        return undefined;
    }
    return { id: snapshot.id, name: snapshot.name };
}
