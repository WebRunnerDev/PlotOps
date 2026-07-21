import type {
    TaskActivityChange,
    TaskActivityEvent,
    TaskActivityMetadata,
} from "@/features/tasks/model/types";

import { TASK_ACTIVITY_FEED_LIMIT } from "@/features/tasks/model/constants";
import { supabase } from "@/shared/api/supabase";

type DatabaseActivityLog = {
    action: string;
    created_at: string;
    id: string;
    metadata: unknown;
    project_id: string;
    task_id: string;
    user: DatabaseProfile | DatabaseProfile[] | null;
    user_id: null | string;
};

type DatabaseProfile = {
    avatar_url: null | string;
    id: string;
    username: null | string;
};

const ACTIVITY_SELECT = `
  id,
  task_id,
  project_id,
  user_id,
  action,
  metadata,
  created_at,
  user:profiles!activity_log_user_id_fkey (
    id,
    username,
    avatar_url
  )
`;

export async function fetchTaskActivity(
    taskId: string,
    limit = TASK_ACTIVITY_FEED_LIMIT,
) {
    const result = await supabase
        .from("activity_log")
        .select(ACTIVITY_SELECT)
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(limit);

    return {
        ...result,
        data: result.data?.map((row) => mapActivity(row as DatabaseActivityLog)),
    };
}

export async function insertTaskActivityEvent(input: {
    action: string;
    changes: TaskActivityChange[];
    projectId: string;
    taskId: string;
}) {
    if (input.changes.length === 0) {
        return { data: null, error: null };
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: null, error: new Error("Not authenticated") };
    }

    const result = await supabase
        .from("activity_log")
        .insert({
            action: input.action,
            metadata: { changes: input.changes } satisfies TaskActivityMetadata,
            project_id: input.projectId,
            task_id: input.taskId,
            user_id: user.id,
        })
        .select(ACTIVITY_SELECT)
        .single();

    return {
        ...result,
        data: result.data ? mapActivity(result.data as DatabaseActivityLog) : null,
    };
}

function asProfile(
    value: DatabaseProfile | DatabaseProfile[] | null | undefined,
): DatabaseProfile | null {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isActivityField(value: unknown): value is TaskActivityChange["field"] {
    return (
        value === "archived" ||
        value === "assignee" ||
        value === "board" ||
        value === "branch" ||
        value === "deadline" ||
        value === "labels" ||
        value === "pr" ||
        value === "priority" ||
        value === "status" ||
        value === "title" ||
        value === "type"
    );
}

function mapActivity(row: DatabaseActivityLog): TaskActivityEvent {
    const user = asProfile(row.user);

    return {
        action: row.action,
        createdAt: row.created_at,
        id: row.id,
        metadata: parseMetadata(row.metadata),
        taskId: row.task_id,
        user: user?.username
            ? {
                  avatarUrl: user.avatar_url ?? undefined,
                  id: user.id,
                  name: user.username,
              }
            : undefined,
    };
}

function parseMetadata(raw: unknown): TaskActivityMetadata {
    if (!raw || typeof raw !== "object") {
        return { changes: [] };
    }

    const changesRaw = (raw as { changes?: unknown }).changes;
    if (!Array.isArray(changesRaw)) {
        return { changes: [] };
    }

    const changes: TaskActivityChange[] = [];
    for (const item of changesRaw) {
        if (!item || typeof item !== "object") continue;
        const field = (item as { field?: unknown }).field;
        if (!isActivityField(field)) continue;
        changes.push({
            field,
            from: (item as { from?: unknown }).from,
            to: (item as { to?: unknown }).to,
        });
    }

    return { changes };
}
