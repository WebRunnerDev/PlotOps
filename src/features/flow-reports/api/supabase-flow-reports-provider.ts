import type { FlowReportsProvider } from "@/features/flow-reports/api/flow-reports-provider";
import type {
    FlowHistory,
    FlowStatusChange,
    FlowTask,
} from "@/features/flow-reports/model/types";

import { supabase } from "@/shared/api/supabase";

type RawChange = {
    changed_at?: unknown;
    from_status?: unknown;
    from_status_name?: unknown;
    task_id?: unknown;
    to_status?: unknown;
    to_status_name?: unknown;
};

type RawTask = {
    archived_at?: unknown;
    created_at?: unknown;
    id?: unknown;
    key?: unknown;
    status?: unknown;
    title?: unknown;
};

export const supabaseFlowReportsProvider: FlowReportsProvider = {
    async fetchBoardFlowHistory(boardId, since) {
        const { data, error } = await supabase.rpc("get_board_flow_history", {
            p_board_id: boardId,
            p_since: since.toISOString(),
        });
        if (error) throw error;
        return parseFlowHistory(data);
    },
};

/** Parses the `get_board_flow_history` jsonb; drops malformed rows. */
export function parseFlowHistory(raw: unknown): FlowHistory {
    const record =
        raw && typeof raw === "object"
            ? (raw as { changes?: unknown; tasks?: unknown })
            : {};
    const tasks: FlowTask[] = [];
    for (const item of asArray<RawTask>(record.tasks)) {
        if (
            typeof item.id !== "string" ||
            typeof item.status !== "string" ||
            typeof item.created_at !== "string"
        ) {
            continue;
        }
        tasks.push({
            archivedAt:
                typeof item.archived_at === "string" ? item.archived_at : null,
            createdAt: item.created_at,
            id: item.id,
            key: typeof item.key === "string" ? item.key : "",
            status: item.status,
            title: typeof item.title === "string" ? item.title : "",
        });
    }

    const changes: FlowStatusChange[] = [];
    for (const item of asArray<RawChange>(record.changes)) {
        if (
            typeof item.task_id !== "string" ||
            typeof item.to_status !== "string" ||
            typeof item.changed_at !== "string"
        ) {
            continue;
        }
        changes.push({
            changedAt: item.changed_at,
            fromStatus:
                typeof item.from_status === "string" ? item.from_status : null,
            fromStatusName: stringOrNull(item.from_status_name),
            taskId: item.task_id,
            toStatus: item.to_status,
            toStatusName: stringOrNull(item.to_status_name),
        });
    }

    return { changes, tasks };
}

function asArray<T>(value: unknown): T[] {
    return Array.isArray(value)
        ? value.filter(
              (item): item is T => Boolean(item) && typeof item === "object"
          )
        : [];
}

function stringOrNull(value: unknown): null | string {
    return typeof value === "string" ? value : null;
}
