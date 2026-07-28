import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";
import type {
    AssigneeChangeMetadata,
    AssignmentMetadata,
    AuthorChangeMetadata,
    BoardMoveMetadata,
    Notification,
    NotificationKind,
    NotificationMetadata,
    PriorityChangeMetadata,
    StatusChangeMetadata,
    TaskWatcher,
} from "@/features/notifications/model/types";

import { supabase } from "@/shared/api/supabase";

const NOTIFICATIONS_SELECT = `
  id,
  kind,
  project_id,
  task_id,
  task_key,
  task_title,
  created_at,
  read_at,
  metadata
`;

type DatabaseNotificationRow = {
    created_at: string;
    id: string;
    kind: string;
    metadata: unknown;
    project_id: string;
    read_at: null | string;
    task_id: string;
    task_key: string;
    task_title: string;
};

type ProfileRow = {
    avatar_url: null | string;
    id: string;
    username: null | string;
};

export async function addTaskWatch(input: {
    projectId: string;
    taskId: string;
}) {
    const userId = await requireUserId();

    const { error } = await supabase.from("task_watchers").upsert(
        {
            project_id: input.projectId,
            task_id: input.taskId,
            user_id: userId,
        },
        { onConflict: "task_id,user_id" }
    );

    if (error) throw error;
}

export async function cleanupNotificationsForUser() {
    const { error } = await supabase.rpc("cleanup_notifications_for_user");
    if (error) throw error;
}

export async function createNotificationsForAssignmentChange(input: {
    metadata: NotificationMetadata;
    projectId: string;
    recipientId: string;
    taskId: string;
}) {
    const { error } = await supabase.rpc(
        "create_notifications_for_assignment_change",
        {
            p_metadata: input.metadata,
            p_project_id: input.projectId,
            p_recipient_id: input.recipientId,
            p_task_id: input.taskId,
        }
    );
    if (error) throw error;
}

export async function createNotificationsForAuthorChange(input: {
    metadata: NotificationMetadata;
    projectId: string;
    recipientId: string;
    taskId: string;
}) {
    const { error } = await supabase.rpc(
        "create_notifications_for_author_change",
        {
            p_metadata: input.metadata,
            p_project_id: input.projectId,
            p_recipient_id: input.recipientId,
            p_task_id: input.taskId,
        }
    );
    if (error) throw error;
}

export async function createNotificationsForStatusChange(input: {
    metadata: NotificationMetadata;
    projectId: string;
    taskId: string;
}) {
    const { error } = await supabase.rpc(
        "create_notifications_for_status_change",
        {
            p_metadata: input.metadata,
            p_project_id: input.projectId,
            p_task_id: input.taskId,
        }
    );
    if (error) throw error;
}

export async function createNotificationsForWatchers(input: {
    excludeRecipientIds?: string[];
    kind: Exclude<NotificationKind, "assignment">;
    metadata: NotificationMetadata;
    projectId: string;
    taskId: string;
}) {
    const { error } = await supabase.rpc("create_notifications_for_watchers", {
        p_exclude_recipient_ids: input.excludeRecipientIds ?? [],
        p_kind: input.kind,
        p_metadata: input.metadata,
        p_project_id: input.projectId,
        p_task_id: input.taskId,
    });
    if (error) throw error;
}

/** One round-trip multi-kind fan-out (always-on + Watcher dedupe in SQL). */
export async function createTaskNotifications(input: {
    events: TaskNotificationEvent[];
    projectId: string;
    taskId: string;
}) {
    if (input.events.length === 0) return;

    const { error } = await supabase.rpc("create_task_notifications", {
        p_events: input.events.map((event) => ({
            kind: event.kind,
            metadata: event.metadata,
            ...(event.recipientId ? { recipient_id: event.recipientId } : {}),
        })),
        p_project_id: input.projectId,
        p_task_id: input.taskId,
    });
    if (error) throw error;
}

export async function fetchNotificationsList(input: {
    limit: number;
    offset: number;
    projectId?: string;
    q?: string;
}): Promise<{
    items: Notification[];
}> {
    const userId = await requireUserId();
    const limit = Math.max(1, input.limit);
    const from = Math.max(0, input.offset);
    const to = from + limit - 1;

    let query = supabase
        .from("notifications")
        .select(NOTIFICATIONS_SELECT)
        .eq("recipient_id", userId);

    if (input.projectId) {
        query = query.eq("project_id", input.projectId);
    }

    const q = input.q?.trim();
    if (q) {
        const escaped = escapeIlikePattern(q);
        query = query.or(
            `task_key.ilike.%${escaped}%,task_title.ilike.%${escaped}%`
        );
    }

    // Unread-first: NULL read_at must sort before timestamps.
    query = query
        .order("read_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false });

    const { data, error } = await query.range(from, to);
    if (error) throw error;

    return {
        items: (data ?? []).map((row) =>
            mapNotificationRow(row as DatabaseNotificationRow)
        ),
    };
}

export async function fetchTaskNavigation(input: {
    taskId: string;
}): Promise<{ boardId: string; projectId: string }> {
    const { data, error } = await supabase
        .from("tasks")
        .select("project_id,board_id")
        .eq("id", input.taskId)
        .single();

    if (error) throw error;
    return {
        boardId: data.board_id,
        projectId: data.project_id,
    };
}

export async function fetchTaskWatchers(input: {
    projectId: string;
    taskId: string;
}): Promise<{ isWatching: boolean; watchers: TaskWatcher[] }> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("task_watchers")
        .select(
            `
          user:profiles!task_watchers_user_id_fkey(
            id,
            username,
            avatar_url
          )
        `
        )
        .eq("task_id", input.taskId)
        .eq("project_id", input.projectId);

    if (error) throw error;

    const watchers: TaskWatcher[] = [];
    for (const row of data ?? []) {
        const raw = (row as { user?: null | ProfileRow | ProfileRow[] }).user;
        const profile = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
        if (!profile) continue;
        watchers.push({
            avatarUrl: profile.avatar_url,
            name: profile.username ?? profile.id,
            userId: profile.id,
        });
    }

    return {
        isWatching: watchers.some((watcher) => watcher.userId === userId),
        watchers,
    };
}

export async function fetchUnreadNotificationsCount(input: {
    projectId?: string;
}): Promise<number> {
    const userId = await requireUserId();
    let query = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);

    if (input.projectId) {
        query = query.eq("project_id", input.projectId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
}

export async function markAllNotificationsRead(input: { projectId?: string }) {
    const { error } = await supabase.rpc("mark_notifications_read_in_scope", {
        p_project_id: input.projectId ?? null,
    });
    if (error) throw error;
}

export async function markNotificationsRead(notificationIds: string[]) {
    if (notificationIds.length === 0) return;
    const { error } = await supabase.rpc("mark_notifications_read", {
        p_notification_ids: notificationIds,
    });
    if (error) throw error;
}

export async function removeTaskWatch(input: { taskId: string }) {
    const userId = await requireUserId();

    const { error } = await supabase
        .from("task_watchers")
        .delete()
        .eq("task_id", input.taskId)
        .eq("user_id", userId);

    if (error) throw error;
}

/** Escape `%`, `_`, `\` for ILIKE and strip `,` which breaks PostgREST `.or()`. */
function escapeIlikePattern(value: string) {
    return value
        .replaceAll("\\", "\\\\")
        .replaceAll("%", String.raw`\%`)
        .replaceAll("_", String.raw`\_`)
        .replaceAll(",", " ");
}

function mapNotificationMetadata(
    kind: NotificationKind,
    metadata: unknown
): NotificationMetadata {
    if (!metadata || typeof metadata !== "object") {
        return {};
    }

    switch (kind) {
        case "assignee_change": {
            return metadata as AssigneeChangeMetadata;
        }
        case "assignment": {
            return metadata as AssignmentMetadata;
        }
        case "author_change": {
            return metadata as AuthorChangeMetadata;
        }
        case "board_move": {
            return metadata as BoardMoveMetadata;
        }
        case "priority_change": {
            return metadata as PriorityChangeMetadata;
        }
        case "status_change": {
            return metadata as StatusChangeMetadata;
        }
        default: {
            return metadata as Record<string, unknown>;
        }
    }
}

function mapNotificationRow(row: DatabaseNotificationRow): Notification {
    const kind = row.kind as NotificationKind;
    return {
        createdAt: row.created_at,
        id: row.id,
        kind,
        metadata: mapNotificationMetadata(kind, row.metadata ?? {}),
        projectId: row.project_id,
        readAt: row.read_at,
        taskId: row.task_id,
        taskKey: row.task_key,
        taskTitle: row.task_title,
    };
}

async function requireUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not authenticated");
    return data.user.id;
}
