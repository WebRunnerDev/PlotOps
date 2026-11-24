import type { FlowReportsProvider } from "@/features/flow-reports/api/flow-reports-provider";

import { getGuestSandbox } from "@/features/guest-mode";

/** Same selection as `get_board_flow_history`, over the Guest sandbox. */
export const guestFlowReportsProvider: FlowReportsProvider = {
    async fetchBoardFlowHistory(boardId, since) {
        const sandbox = getGuestSandbox();
        if (!sandbox) throw new Error("No Guest Session");

        const sinceMs = since.getTime();
        const tasks = sandbox.tasks.filter(
            (task) =>
                task.boardId === boardId &&
                task.type !== "epic" &&
                (!task.archivedAt || Date.parse(task.archivedAt) >= sinceMs)
        );
        const taskIds = new Set(tasks.map((task) => task.id));
        const changes = (sandbox.statusChanges ?? []).filter((change) =>
            taskIds.has(change.taskId)
        );
        const moving = new Set(
            changes
                .filter((change) => Date.parse(change.changedAt) >= sinceMs)
                .map((change) => change.taskId)
        );

        return {
            changes: changes
                .filter((change) => moving.has(change.taskId))
                .toSorted((a, b) => a.changedAt.localeCompare(b.changedAt))
                .map((change) => ({
                    changedAt: change.changedAt,
                    fromStatus: change.fromStatus,
                    fromStatusName: change.fromStatusName,
                    taskId: change.taskId,
                    toStatus: change.toStatus,
                    toStatusName: change.toStatusName,
                })),
            tasks: tasks.map((task) => ({
                archivedAt: task.archivedAt ?? null,
                createdAt: task.createdAt,
                id: task.id,
                key: task.key,
                status: task.status,
                title: task.title,
            })),
        };
    },
};
