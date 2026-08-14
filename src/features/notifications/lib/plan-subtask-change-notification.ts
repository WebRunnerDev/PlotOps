import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

export type PlanSubtaskChangeInput = {
    action: SubtaskChangeAction;
    /** Required for `closed`. True when the Subtask already sat in a Done column. */
    fromDone?: boolean;
    parentId?: string;
    source?: "app" | "github_webhook";
    subtaskKey: string;
    /** Required for `closed`. True when the new column is Done. */
    toDone?: boolean;
};

export type SubtaskChangeAction = "closed" | "created";

/**
 * Call-site seam: Subtask created or closed → Watcher `subtask_change` on the Parent Task.
 * Fan-out uses `create_task_notifications` with the Parent Task id. Actor exclusion is in the RPC.
 */
export function planSubtaskChangeNotification(
    input: PlanSubtaskChangeInput
): TaskNotificationEvent | undefined {
    if (!input.parentId) return undefined;
    if (!input.subtaskKey) return undefined;

    if (input.action === "closed" && (!input.toDone || input.fromDone))
        return undefined;

    return {
        kind: "subtask_change",
        metadata: {
            action: input.action,
            source: input.source ?? "app",
            subtaskKey: input.subtaskKey,
        },
    };
}
