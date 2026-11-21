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
import { expandNotificationSearchQuery } from "@/features/notifications/lib/expand-notification-search-query";
import { resolveNotificationActor } from "@/features/notifications/lib/resolve-notification-actor";

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
        const expansion = expandNotificationSearchQuery(query);
        const matchedKinds = new Set(expansion.matchedKinds);
        rows = rows.filter(
            (row) =>
                row.taskKey.toLowerCase().includes(query) ||
                row.taskTitle.toLowerCase().includes(query) ||
                matchedKinds.has(row.kind)
        );
    }

    // Same order as `list_notifications_for_recipient`: newest first only,
    // so reading a row never moves it.
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

export function markGuestNotificationsUnread(notificationIds: string[]): void {
    if (notificationIds.length === 0) return;
    const ids = new Set(notificationIds);
    updateGuestSandbox((sandbox) => {
        for (const row of sandbox.notifications) {
            if (ids.has(row.id)) {
                row.readAt = null;
            }
        }
    });
}

function mapNotification(row: GuestNotification): Notification {
    const metadata = row.metadata as NotificationMetadata;
    return {
        actor: resolveNotificationActor({ metadata }),
        createdAt: row.createdAt,
        id: row.id,
        kind: row.kind as NotificationKind,
        metadata,
        projectId: row.projectId,
        readAt: row.readAt,
        taskId: row.taskId,
        taskKey: row.taskKey,
        taskTitle: row.taskTitle,
    };
}
