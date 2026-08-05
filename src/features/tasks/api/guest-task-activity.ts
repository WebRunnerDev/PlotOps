import type {
    TaskActivityChange,
    TaskActivityEvent,
    TaskActivityField,
} from "@/features/tasks/model/types";

import { getGuestSandbox } from "@/features/guest-mode";
import { TASK_ACTIVITY_FEED_LIMIT } from "@/features/tasks/model/constants";

const ACTIVITY_FIELDS = new Set<TaskActivityField>([
    "archived",
    "assignee",
    "board",
    "branch",
    "deadline",
    "labels",
    "pr",
    "priority",
    "status",
    "title",
    "type",
]);

/** Static Activity rows from the Guest seed — no Supabase, no local fan-out. */
export function fetchGuestTaskActivity(
    taskId: string,
    limit = TASK_ACTIVITY_FEED_LIMIT
): TaskActivityEvent[] {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return [];
    }

    return sandbox.activity
        .filter((event) => event.taskId === taskId)
        .map((event) => {
            const changes: TaskActivityChange[] = [];
            for (const change of event.metadata.changes) {
                if (!isActivityField(change.field)) continue;
                changes.push({
                    field: change.field,
                    from: change.from,
                    to: change.to,
                });
            }

            return {
                action: event.action,
                createdAt: event.createdAt,
                id: event.id,
                metadata: { changes },
                taskId: event.taskId,
                user: event.user
                    ? {
                          avatarUrl: event.user.avatarUrl,
                          id: event.user.id,
                          name: event.user.name,
                      }
                    : undefined,
            };
        })
        .toSorted(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        )
        .slice(0, limit);
}

function isActivityField(value: unknown): value is TaskActivityField {
    return (
        typeof value === "string" &&
        ACTIVITY_FIELDS.has(value as TaskActivityField)
    );
}
