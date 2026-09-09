import { createTaskNotifications } from "@/features/notifications/api/notifications-api";
import { newMentioneeIds } from "@/features/notifications/lib/extract-mentionee-ids";
import { planCommentWatcherNotification } from "@/features/notifications/lib/plan-comment-watcher-notification";

/**
 * After Comment create: fan out Watcher `comment`, excluding Mentionees who
 * receive always-on `mention` for the same body (ADR 0027).
 * Never blocks the primary write; actor exclusion lives in the RPC.
 * Comment edit must not call this.
 */
export async function notifyCommentWatchersBestEffort(input: {
    body: string;
    commentId: string;
    projectId: string;
    taskId: string;
}): Promise<void> {
    const event = planCommentWatcherNotification({
        action: "create",
        commentId: input.commentId,
        mentioneeIds: newMentioneeIds("", input.body),
    });
    if (!event) return;

    try {
        await createTaskNotifications({
            events: [event],
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary Comment mutation.
    }
}
