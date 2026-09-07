import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

export type PlanDescriptionWatcherInput = {
    /** New Mentionees who receive always-on `mention` for this save — excluded. */
    mentioneeIds?: readonly string[];
    nextBody: string;
    previousBody: string;
};

/**
 * Call-site seam: Description body change → Watcher `description_change`.
 * New Mentionees on the same save are excluded so they get `mention` only.
 * Actor exclusion happens in `create_task_notifications`.
 * Description is not an Activity field — compare previous/next bodies.
 */
export function planDescriptionWatcherNotification(
    input: PlanDescriptionWatcherInput
): TaskNotificationEvent | undefined {
    if (input.previousBody === input.nextBody) return undefined;

    const mentioneeIds = (input.mentioneeIds ?? []).filter(Boolean);
    return {
        ...(mentioneeIds.length > 0
            ? { excludeRecipientIds: [...mentioneeIds] }
            : {}),
        kind: "description_change",
        metadata: { source: "app" },
    };
}
