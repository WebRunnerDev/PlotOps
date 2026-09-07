import { createTaskNotifications } from "@/features/notifications/api/notifications-api";
import { newMentioneeIds } from "@/features/notifications/lib/extract-mentionee-ids";
import { planDescriptionWatcherNotification } from "@/features/notifications/lib/plan-description-watcher-notification";

/**
 * After Description save: fan out Watcher `description_change`, excluding
 * Mentionees who receive always-on `mention` for the same save (ADR 0027).
 * Never blocks the primary write; actor exclusion lives in the RPC.
 */
export async function notifyDescriptionWatchersBestEffort(input: {
    nextBody: string;
    previousBody: string;
    projectId: string;
    taskId: string;
}): Promise<void> {
    const event = planDescriptionWatcherNotification({
        mentioneeIds: newMentioneeIds(input.previousBody, input.nextBody),
        nextBody: input.nextBody,
        previousBody: input.previousBody,
    });
    if (!event) return;

    try {
        await createTaskNotifications({
            events: [event],
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary Description mutation.
    }
}
