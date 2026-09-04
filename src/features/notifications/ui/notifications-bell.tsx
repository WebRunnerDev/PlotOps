import { useNavigate } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatNotificationContext } from "@/features/notifications/lib/format-notification-context";
import { useAwaitableDrawerClose } from "@/features/notifications/model/use-awaitable-drawer-close";
import {
    useMarkAllNotificationsRead,
    useNotificationsList,
    useNotificationsRealtime,
    useUnreadNotificationsCount,
} from "@/features/notifications/model/use-notifications";
import { useOpenNotification } from "@/features/notifications/model/use-open-notification";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/shared/shadcn/ui/drawer";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const PREVIEW_LIMIT = 20;

export function NotificationsBell() {
    const { t } = useTranslation("common");
    const navigate = useNavigate();
    const openNotification = useOpenNotification();
    const [open, setOpen] = useState(false);
    const { closeAndWait, onOpenChangeComplete } = useAwaitableDrawerClose(
        open,
        setOpen
    );

    useNotificationsRealtime();

    const { data: unreadCount = 0 } = useUnreadNotificationsCount();
    const markAll = useMarkAllNotificationsRead();
    const listQuery = useNotificationsList({
        cleanupFirst: true,
        enabled: open,
        limit: PREVIEW_LIMIT,
        offset: 0,
    });

    return (
        <>
            <Button
                aria-label={t("nav.notifications")}
                className="relative size-8 rounded-none transition-colors duration-200 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-primary"
                onClick={() => setOpen(true)}
                size="icon"
                type="button"
                variant="ghost"
            >
                <BellIcon className="size-4" />
                {unreadCount > 0 ? (
                    <span
                        className={cn(
                            "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
                        )}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                ) : null}
            </Button>

            <Drawer
                onOpenChange={setOpen}
                onOpenChangeComplete={onOpenChangeComplete}
                open={open}
                swipeDirection="right"
            >
                <DrawerContent>
                    <DrawerHeader className="border-b border-border p-4 text-left">
                        <DrawerTitle>{t("nav.notifications")}</DrawerTitle>
                        <DrawerDescription>
                            {t("notifications.previewDescription")}
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                        <Button
                            disabled={markAll.isPending || unreadCount === 0}
                            onClick={() => {
                                void markAll.mutateAsync({});
                            }}
                            size="sm"
                            variant="outline"
                        >
                            {t("notifications.markAllRead")}
                        </Button>
                        <Button
                            onClick={() => {
                                setOpen(false);
                                void navigate({ to: "/notifications" });
                            }}
                            size="sm"
                            variant="ghost"
                        >
                            {t("notifications.viewAll")}
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {listQuery.isLoading ? (
                            <div className="flex justify-center py-10">
                                <Spinner className="size-6 text-primary" />
                            </div>
                        ) : listQuery.isError ? (
                            <div className="flex flex-col items-center gap-3 px-2 py-8">
                                <p className="text-center text-sm text-destructive">
                                    {t("notifications.loadFailed")}
                                </p>
                                <Button
                                    onClick={() => void listQuery.refetch()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {t("notifications.retry")}
                                </Button>
                            </div>
                        ) : (listQuery.data?.length ?? 0) === 0 ? (
                            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                                {t("nav.notificationsEmpty")}
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {(listQuery.data ?? []).map((item) => (
                                    <li key={item.id}>
                                        <button
                                            className={cn(
                                                "flex w-full flex-col gap-0.5 px-3 py-3 text-left hover:bg-muted/40",
                                                item.readAt
                                                    ? "opacity-70"
                                                    : "bg-muted/20"
                                            )}
                                            onClick={() => {
                                                void openNotification(item, {
                                                    onFallback: () =>
                                                        navigate({
                                                            to: "/notifications",
                                                        }),
                                                    onNavigate: closeAndWait,
                                                });
                                            }}
                                            type="button"
                                        >
                                            <span className="font-mono text-meta text-muted-foreground">
                                                {item.taskKey}
                                            </span>
                                            <span className="truncate text-sm font-medium">
                                                {item.taskTitle}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatNotificationContext(
                                                    item,
                                                    t
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
