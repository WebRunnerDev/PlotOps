import { useNavigate, useParams } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

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

const PREVIEW_LIMIT = 20;
const SKELETON_COUNT = 5;

export function NotificationDrawer() {
    const { t } = useTranslation("common");
    const navigate = useNavigate();
    const parameters = useParams({ strict: false });
    const openNotification = useOpenNotification();
    const [open, setOpen] = useState(false);
    const { closeAndWait, onOpenChangeComplete } = useAwaitableDrawerClose(
        open,
        setOpen
    );

    const projectId =
        typeof parameters.projectId === "string"
            ? parameters.projectId
            : undefined;
    const boardId =
        typeof parameters.boardId === "string" ? parameters.boardId : undefined;

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
                className="relative size-8"
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
                                void navigate({
                                    search: {
                                        ...(projectId && boardId
                                            ? {
                                                  returnBoardId: boardId,
                                                  returnProjectId: projectId,
                                              }
                                            : {}),
                                    },
                                    to: "/notifications",
                                });
                            }}
                            size="sm"
                            variant="ghost"
                        >
                            {t("notifications.viewAll")}
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {listQuery.isLoading ? (
                            <ul
                                aria-busy="true"
                                aria-live="polite"
                                className="divide-y divide-border"
                                role="status"
                            >
                                {Array.from(
                                    { length: SKELETON_COUNT },
                                    (_, index) => (
                                        <li
                                            aria-hidden
                                            className="flex gap-2.5 px-3 py-3"
                                            key={index}
                                        >
                                            <span className="mt-1.5 size-1.5 shrink-0 leading-none">
                                                <Skeleton
                                                    circle
                                                    height={6}
                                                    width={6}
                                                />
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                                                <Skeleton
                                                    containerClassName="block leading-none"
                                                    height={14}
                                                    width="75%"
                                                />
                                                <Skeleton
                                                    containerClassName="block leading-none"
                                                    height={12}
                                                    width="45%"
                                                />
                                            </span>
                                        </li>
                                    )
                                )}
                            </ul>
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
                                {(listQuery.data ?? []).map((item) => {
                                    const isUnread = item.readAt == undefined;

                                    return (
                                        <li key={item.id}>
                                            <button
                                                className={cn(
                                                    "relative flex w-full gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/40",
                                                    isUnread
                                                        ? "bg-muted/30 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary"
                                                        : "opacity-60"
                                                )}
                                                onClick={() => {
                                                    void openNotification(
                                                        item,
                                                        {
                                                            onFallback: () =>
                                                                navigate({
                                                                    to: "/notifications",
                                                                }),
                                                            onNavigate:
                                                                closeAndWait,
                                                        }
                                                    );
                                                }}
                                                type="button"
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                                                        isUnread
                                                            ? "bg-primary"
                                                            : "bg-transparent"
                                                    )}
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span
                                                        className={cn(
                                                            "text-sm",
                                                            isUnread
                                                                ? "text-foreground"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {formatNotificationContext(
                                                            item,
                                                            t
                                                        )}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            "truncate text-xs",
                                                            isUnread
                                                                ? "text-foreground/80"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="font-mono text-meta">
                                                            {item.taskKey}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {" · "}
                                                        </span>
                                                        {item.taskTitle}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
