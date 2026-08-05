import type {
    Notification,
    NotificationKind,
    NotificationMetadata,
} from "@/features/notifications/model/types";

import {
    getGuestSandbox,
    type GuestNotification,
    updateGuestSandbox,
} from "@/features/guest-mode";

export function countGuestUnreadNotifications(projectId?: string): number {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return 0;
    }

    return sandbox.notifications.filter((row) => {
        if (row.readAt) return false;
        if (projectId && row.projectId !== projectId) return false;
        return true;
    }).length;
}

/** Static Notification rows from the Guest seed — no Supabase / Realtime. */
export function listGuestNotifications(input: {
    limit: number;
    offset: number;
    projectId?: string;
    q?: string;
}): Notification[] {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return [];
    }

    const query = input.q?.trim().toLowerCase() ?? "";
    let rows = sandbox.notifications.map((row) => mapNotification(row));

    if (input.projectId) {
        rows = rows.filter((row) => row.projectId === input.projectId);
    }

    if (query) {
        rows = rows.filter(
            (row) =>
                row.taskKey.toLowerCase().includes(query) ||
                row.taskTitle.toLowerCase().includes(query)
        );
    }

    rows = rows.toSorted(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return rows.slice(input.offset, input.offset + input.limit);
}

export function markAllGuestNotificationsRead(projectId?: string): void {
    const now = new Date().toISOString();
    updateGuestSandbox((sandbox) => {
        for (const row of sandbox.notifications) {
            if (projectId && row.projectId !== projectId) continue;
            if (!row.readAt) {
                row.readAt = now;
            }
        }
    });
}

export function markGuestNotificationsRead(notificationIds: string[]): void {
    if (notificationIds.length === 0) return;
    const ids = new Set(notificationIds);
    const now = new Date().toISOString();
    updateGuestSandbox((sandbox) => {
        for (const row of sandbox.notifications) {
            if (ids.has(row.id) && !row.readAt) {
                row.readAt = now;
            }
        }
    });
}

function mapNotification(row: GuestNotification): Notification {
    return {
        createdAt: row.createdAt,
        id: row.id,
        kind: row.kind as NotificationKind,
        metadata: row.metadata as NotificationMetadata,
        projectId: row.projectId,
        readAt: row.readAt,
        taskId: row.taskId,
        taskKey: row.taskKey,
        taskTitle: row.taskTitle,
    };
}
