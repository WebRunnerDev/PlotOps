import type { NotificationKind } from "@/features/notifications/model/types";

export type NamedReference = {
    id: string;
    name: string;
};

export type PlanTaskNotificationInput = {
    assignee?: {
        from: NamedReference | undefined;
        to: NamedReference | undefined;
    };
    author?: {
        from: NamedReference | undefined;
        to: NamedReference | undefined;
    };
    boardMove?: {
        fromBoard: NamedReference;
        fromStatus?: NamedReference;
        toBoard: NamedReference;
        toStatus?: NamedReference;
    };
    priority?: {
        from: string;
        to: string;
    };
    /** Same-Board column move only. Ignored when `boardMove` is set (ADR 0013). */
    status?: {
        from: NamedReference;
        to: NamedReference;
    };
};

/** Event payload for `create_task_notifications` (one round-trip, multi-kind). */
export type TaskNotificationEvent = {
    kind: NotificationKind;
    metadata: Record<string, unknown>;
    /** Always-on delivery target. Absent → Watcher fan-out. */
    recipientId?: string;
};

/**
 * Plans fan-out events for a structural Task save.
 * Actor exclusion and always-on/Watcher dedupe happen in the RPC.
 */
export function planTaskNotificationEvents(
    input: PlanTaskNotificationInput
): TaskNotificationEvent[] {
    const events: TaskNotificationEvent[] = [];

    if (input.boardMove) {
        events.push({
            kind: "board_move",
            metadata: {
                fromBoard: input.boardMove.fromBoard,
                fromStatus: input.boardMove.fromStatus,
                toBoard: input.boardMove.toBoard,
                toStatus: input.boardMove.toStatus,
            },
        });
    } else if (input.status) {
        events.push({
            kind: "status_change",
            metadata: {
                from: input.status.from,
                to: input.status.to,
            },
        });
    }

    if (input.priority) {
        events.push({
            kind: "priority_change",
            metadata: {
                from: input.priority.from,
                to: input.priority.to,
            },
        });
    }

    if (input.assignee?.to) {
        const metadata = {
            assignee: input.assignee.to,
            previousAssignee: input.assignee.from,
        };
        events.push(
            {
                kind: "assignment",
                metadata,
                recipientId: input.assignee.to.id,
            },
            {
                kind: "assignee_change",
                metadata,
            }
        );
    }

    if (input.author?.to) {
        const metadata = {
            author: input.author.to,
            previousAuthor: input.author.from,
        };
        events.push(
            {
                kind: "author_change",
                metadata,
                recipientId: input.author.to.id,
            },
            {
                kind: "author_change",
                metadata,
            }
        );
    }

    return events;
}
