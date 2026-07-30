import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";

type ActivityChangeLike = {
    field: string;
    from: unknown;
    to: unknown;
};

type IdName = { id: string; name: string };

/**
 * Call-site seam: Activity board (+ optional status) diff → Watcher `board_move`.
 * Coalesces remapped status into metadata (ADR 0013). Actor exclusion is in the RPC.
 */
export function planBoardMoveWatcherNotification(
    activityChanges: ActivityChangeLike[]
): TaskNotificationEvent | undefined {
    const boardChange = activityChanges.find(
        (entry) => entry.field === "board"
    );
    if (!boardChange) return undefined;

    const fromBoard = asIdName(boardChange.from);
    const toBoard = asIdName(boardChange.to);
    if (!fromBoard || !toBoard || fromBoard.id === toBoard.id) {
        return undefined;
    }

    const statusChange = activityChanges.find(
        (entry) => entry.field === "status"
    );
    const fromStatus = statusChange ? asIdName(statusChange.from) : undefined;
    const toStatus = statusChange ? asIdName(statusChange.to) : undefined;

    return {
        kind: "board_move",
        metadata: {
            fromBoard,
            fromStatus: fromStatus ?? undefined,
            source: "app",
            toBoard,
            toStatus: toStatus ?? undefined,
        },
    };
}

function asIdName(value: unknown): IdName | undefined {
    if (!value || typeof value !== "object") return undefined;
    const snapshot = value as { id?: unknown; name?: unknown };
    if (typeof snapshot.id !== "string" || typeof snapshot.name !== "string") {
        return undefined;
    }
    return { id: snapshot.id, name: snapshot.name };
}
