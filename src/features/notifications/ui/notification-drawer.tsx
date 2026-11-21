import { useNavigate, useParams } from "@tanstack/react-router";
import { BellIcon, BellOff, CheckCheck, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

import { useAwaitableDrawerClose } from "@/features/notifications/model/use-awaitable-drawer-close";
import {
    useMarkAllNotificationsRead,
    useNotificationsList,
    useNotificationsRealtime,
    useUnreadNotificationsCount,
} from "@/features/notifications/model/use-notifications";
import { useOpenNotification } from "@/features/notifications/model/use-open-notification";
import { NotificationList } from "@/features/notifications/ui/notification-list";
import { useProjects } from "@/features/projects";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Drawer,
    DrawerClose,
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
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
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
    /** From a board: filter inbox by that project + enable back-to-board. From home: all projects. */
    const notificationsPageSearch =
        projectId && boardId
            ? {
                  projectId,
                  returnBoardId: boardId,
                  returnProjectId: projectId,
              }
            : {};

    useNotificationsRealtime();

    const { data: unreadCount = 0 } = useUnreadNotificationsCount();
    const markAll = useMarkAllNotificationsRead();
    const { data: projects = [] } = useProjects();
    const listQuery = useNotificationsList({
        cleanupFirst: true,
        enabled: open,
        limit: PREVIEW_LIMIT,
        offset: 0,
    });
    const items = listQuery.data ?? [];

    const projectNameById = useMemo(
        () => new Map(projects.map((project) => [project.id, project.name])),
        [projects]
    );
    const showProjectNames = projects.length > 1;

    const bellLabel =
        unreadCount > 0
            ? t("notifications.bellUnread", { count: unreadCount })
            : t("nav.notifications");

    function goToNotificationsPage() {
        setOpen(false);
        void navigate({
            search: notificationsPageSearch,
            to: "/notifications",
        });
    }

    return (
        <>
            <Button
                aria-label={bellLabel}
                className="relative size-8 rounded-none transition-colors duration-200 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-primary"
                data-testid="notifications-bell"
                onClick={() => setOpen(true)}
                size="icon"
                title={bellLabel}
                type="button"
                variant="ghost"
            >
                <BellIcon className="size-4" />
                {unreadCount > 0 ? (
                    <span
                        aria-hidden
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
                <DrawerContent
                    className="[--notification-surface:var(--color-popover)]"
                    data-testid="notifications-preview"
                >
                    <DrawerHeader className="flex-row items-start justify-between gap-3 border-b border-border p-4 text-left">
                        <div className="flex min-w-0 flex-col gap-1">
                            <DrawerTitle>{t("nav.notifications")}</DrawerTitle>
                            <DrawerDescription data-testid="notifications-unread-summary">
                                {unreadCount > 0
                                    ? t("notifications.unreadCount", {
                                          count: unreadCount,
                                      })
                                    : t("notifications.allCaughtUp")}
                            </DrawerDescription>
                        </div>
                        <DrawerClose
                            render={
                                <Button
                                    aria-label={t("notifications.close")}
                                    className="-mt-1 -mr-1 shrink-0 rounded-none text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                    size="icon-sm"
                                    title={t("notifications.close")}
                                    type="button"
                                    variant="ghost"
                                />
                            }
                        >
                            <XIcon />
                        </DrawerClose>
                    </DrawerHeader>

                    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                        <Button
                            data-testid="notifications-mark-all-read"
                            disabled={markAll.isPending || unreadCount === 0}
                            onClick={() => {
                                markAll.mutate(
                                    {},
                                    {
                                        onError: () => {
                                            toast.error(
                                                t("notifications.updateFailed")
                                            );
                                        },
                                        onSuccess: () => {
                                            toast.success(
                                                t("notifications.markedAllRead")
                                            );
                                        },
                                    }
                                );
                            }}
                            size="sm"
                            variant="outline"
                        >
                            <CheckCheck data-icon="inline-start" />
                            {t("notifications.markAllRead")}
                        </Button>
                        <Button
                            data-testid="notifications-view-all"
                            onClick={goToNotificationsPage}
                            size="sm"
                            variant="ghost"
                        >
                            {t("notifications.viewAll")}
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
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
                                            className="flex gap-3 px-3 py-3"
                                            key={index}
                                        >
                                            <span className="size-7 shrink-0 leading-none">
                                                <Skeleton
                                                    height={28}
                                                    width={28}
                                                />
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
                                                <Skeleton
                                                    containerClassName="block leading-none"
                                                    height={14}
                                                    width="75%"
                                                />
                                                <Skeleton
                                                    containerClassName="block leading-none"
                                                    height={12}
                                                    width="55%"
                                                />
                                                <Skeleton
                                                    containerClassName="block leading-none"
                                                    height={10}
                                                    width="30%"
                                                />
                                            </span>
                                        </li>
                                    )
                                )}
                            </ul>
                        ) : listQuery.isError ? (
                            <div className="flex flex-col items-center gap-3 px-4 py-8">
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
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                                <BellOff
                                    aria-hidden
                                    className="size-6 text-muted-foreground"
                                />
                                <p className="text-sm font-medium">
                                    {t("notifications.emptyTitle")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t("notifications.emptyHint")}
                                </p>
                            </div>
                        ) : (
                            <>
                                <NotificationList
                                    activeTaskId={selectedTaskId}
                                    items={items}
                                    onOpen={(item) => {
                                        void openNotification(item, {
                                            onFallback: () =>
                                                navigate({
                                                    search: notificationsPageSearch,
                                                    to: "/notifications",
                                                }),
                                            onNavigate: closeAndWait,
                                        });
                                    }}
                                    projectNameFor={
                                        showProjectNames
                                            ? (item) =>
                                                  projectNameById.get(
                                                      item.projectId
                                                  )
                                            : undefined
                                    }
                                />
                                {items.length >= PREVIEW_LIMIT ? (
                                    <div className="border-t border-border px-4 py-3 text-center">
                                        <Button
                                            onClick={goToNotificationsPage}
                                            size="sm"
                                            variant="link"
                                        >
                                            {t("notifications.showingLatest", {
                                                count: PREVIEW_LIMIT,
                                            })}
                                        </Button>
                                    </div>
                                ) : undefined}
                            </>
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
