import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

export type PlanCommentWatcherInput = {
    action: "create" | "edit";
    commentId: string;
    /** Mentionees who receive always-on `mention` for this save — excluded from `comment`. */
    mentioneeIds?: readonly string[];
};

/**
 * Call-site seam: Comment create → Watcher `comment`; Comment edit → nothing.
 * Mentionees on the same create are excluded so they get `mention` only.
 * Actor exclusion happens in `create_task_notifications`.
 */
export function planCommentWatcherNotification(
    input: PlanCommentWatcherInput
): TaskNotificationEvent | undefined {
    if (input.action !== "create") return undefined;
    if (!input.commentId) return undefined;

    const mentioneeIds = (input.mentioneeIds ?? []).filter(Boolean);
    return {
        ...(mentioneeIds.length > 0
            ? { excludeRecipientIds: [...mentioneeIds] }
            : {}),
        kind: "comment",
        metadata: {
            commentId: input.commentId,
            source: "app",
        },
    };
}
