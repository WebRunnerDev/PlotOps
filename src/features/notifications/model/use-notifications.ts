import type { RealtimeChannel } from "@supabase/supabase-js";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/features/auth";
import {
    cleanupNotificationsForUser,
    fetchNotificationsList,
    fetchUnreadNotificationsCount,
    markAllNotificationsRead,
    markNotificationsRead,
} from "@/features/notifications/api/notifications-api";
import { notificationsKeys } from "@/features/notifications/model/query-keys";
import { supabase } from "@/shared/api/supabase";

/** Ref-counted Realtime channels per user to avoid extra connections. */
const notificationChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

export function useCleanupNotificationsForUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => cleanupNotificationsForUser(),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: notificationsKeys.all,
            });
        },
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { projectId?: string }) =>
            markAllNotificationsRead(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: notificationsKeys.all,
            });
        },
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (notificationIds: string[]) =>
            markNotificationsRead(notificationIds),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: notificationsKeys.all,
            });
        },
    });
}

export function useNotificationsList(input: {
    cleanupFirst?: boolean;
    enabled?: boolean;
    limit?: number;
    offset?: number;
    projectId?: string;
    q?: string;
}) {
    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;
    const cleanupFirst = input.cleanupFirst ?? false;

    return useQuery({
        enabled: input.enabled ?? true,
        gcTime: 5 * 60 * 1000,
        queryFn: async () => {
            if (cleanupFirst) {
                try {
                    await cleanupNotificationsForUser();
                } catch {
                    // Best-effort retention cleanup before read.
                }
            }
            const { items } = await fetchNotificationsList({
                limit,
                offset,
                projectId: input.projectId,
                q: input.q,
            });
            return items;
        },
        queryKey: notificationsKeys.list({
            limit,
            offset,
            projectId: input.projectId,
            q: input.q,
        }),
        refetchOnWindowFocus: false,
        staleTime: 5000,
    });
}

export function useNotificationsRealtime() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const recipientId = user.id;
        const existing = notificationChannels.get(recipientId);

        if (existing) {
            existing.subscribers += 1;
            return () => releaseNotificationChannel(recipientId);
        }

        const channel = supabase
            .channel(`notifications:${recipientId}:${crypto.randomUUID()}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    filter: `recipient_id=eq.${recipientId}`,
                    schema: "public",
                    table: "notifications",
                },
                () => {
                    void queryClient.invalidateQueries({
                        queryKey: notificationsKeys.all,
                    });
                }
            )
            .subscribe();

        notificationChannels.set(recipientId, { channel, subscribers: 1 });

        return () => releaseNotificationChannel(recipientId);
    }, [queryClient, user]);
}

export function useUnreadNotificationsCount(input?: { projectId?: string }) {
    return useQuery({
        gcTime: 5 * 60 * 1000,
        queryFn: () =>
            fetchUnreadNotificationsCount({
                projectId: input?.projectId,
            }),
        queryKey: notificationsKeys.unreadCount(input?.projectId),
        staleTime: 5000,
    });
}

function releaseNotificationChannel(recipientId: string) {
    const current = notificationChannels.get(recipientId);
    if (!current) return;
    current.subscribers -= 1;
    if (current.subscribers > 0) return;
    void supabase.removeChannel(current.channel);
    notificationChannels.delete(recipientId);
}
