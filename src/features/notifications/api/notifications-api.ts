import type { MentionFanOutRequest } from "@/features/notifications/lib/build-mention-fan-out-request";
import type { TaskNotificationEvent } from "@/features/notifications/lib/plan-task-notification-events";
import type {
    AssigneeChangeMetadata,
    AssignmentMetadata,
    AuthorChangeMetadata,
    BoardMoveMetadata,
    DeadlineChangeMetadata,
    MentionMetadata,
    Notification,
    NotificationKind,
    NotificationMetadata,
    PriorityChangeMetadata,
    StatusChangeMetadata,
    TaskWatcher,
} from "@/features/notifications/model/types";

import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { expandNotificationSearchQuery } from "@/features/notifications/lib/expand-notification-search-query";
import { asJson } from "@/shared/api/database";
import { supabase } from "@/shared/api/supabase";

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
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

/** Watcher kinds only — always-on `assignment` / `mention` use dedicated RPCs. */
type WatcherNotificationKind = Exclude<
    NotificationKind,
    "assignment" | "mention"
>;

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
            p_metadata: asJson(input.metadata),
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
            p_metadata: asJson(input.metadata),
            p_project_id: input.projectId,
            p_recipient_id: input.recipientId,
            p_task_id: input.taskId,
        }
    );
    if (error) throw error;
}

export async function createNotificationsForMentions(
    input: MentionFanOutRequest
) {
    const { error } = await supabase.rpc("create_notifications_for_mentions", {
        p_actor_name: input.actorName ?? undefined,
        p_comment_id: input.commentId ?? undefined,
        p_mentionee_ids: input.mentioneeIds,
        p_source: input.source,
        p_task_id: input.taskId,
    });
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
            p_metadata: asJson(input.metadata),
            p_project_id: input.projectId,
            p_task_id: input.taskId,
        }
    );
    if (error) throw error;
}

export async function createNotificationsForWatchers(input: {
    excludeRecipientIds?: string[];
    kind: WatcherNotificationKind;
    metadata: NotificationMetadata;
    projectId: string;
    taskId: string;
}) {
    const { error } = await supabase.rpc("create_notifications_for_watchers", {
        p_exclude_recipient_ids: input.excludeRecipientIds ?? [],
        p_kind: input.kind,
        p_metadata: asJson(input.metadata),
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
        p_events: asJson(
            input.events.map((event) => ({
                kind: event.kind,
                metadata: event.metadata,
                ...(event.recipientId
                    ? { recipient_id: event.recipientId }
                    : {}),
            }))
        ),
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
    await requireUserId();
    const limit = Math.max(1, input.limit);
    const offset = Math.max(0, input.offset);
    const q = input.q?.trim() || null;
    const expansion = q
        ? expandNotificationSearchQuery(q)
        : { extraPatterns: [], matchedKinds: [] };

    const { data, error } = await supabase.rpc(
        "list_notifications_for_recipient",
        {
            p_extra_patterns:
                expansion.extraPatterns.length > 0
                    ? expansion.extraPatterns
                    : undefined,
            p_limit: limit,
            p_matched_kinds:
                expansion.matchedKinds.length > 0
                    ? expansion.matchedKinds
                    : undefined,
            p_offset: offset,
            p_project_id: input.projectId,
            p_q: q ?? undefined,
        }
    );
    if (error) throw error;

    const rows = (data ?? []) as DatabaseNotificationRow[];

    return {
        items: rows.map((row) => mapNotificationRow(row)),
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
            avatar_url,
            first_name,
            last_name
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
            name: formatProfileDisplayName(profile) || profile.id,
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
        p_project_id: input.projectId,
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
        case "deadline_change": {
            return metadata as DeadlineChangeMetadata;
        }
        case "mention": {
            return metadata as MentionMetadata;
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
