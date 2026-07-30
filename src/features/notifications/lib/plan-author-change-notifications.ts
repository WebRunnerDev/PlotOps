import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

type IdName = { id: string; name: string };

/**
 * Call-site seam: Author transfer diff → always-on + Watcher `author_change`.
 * Clear Author plans nothing. Actor exclusion and always-on/Watcher dedupe
 * happen in `create_task_notifications`. Auto-enroll / auto-Unwatch stay in
 * the task stake trigger (ADR 0012).
 */
export function planAuthorChangeNotifications(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent[] {
    const change = activityChanges.find((entry) => entry.field === "author");
    if (!change) return [];

    const to = asIdName(change.to);
    if (!to) return [];

    const previousAuthor = asIdName(change.from) ?? null;
    const metadata = {
        author: to,
        previousAuthor,
        source: "app" as const,
    };

    return [
        {
            kind: "author_change",
            metadata,
            recipientId: to.id,
        },
        {
            kind: "author_change",
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
