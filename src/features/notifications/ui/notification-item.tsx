import { Mail, MailOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
    Notification,
    NotificationActor,
} from "@/features/notifications/model/types";

import { getUserInitials } from "@/features/auth/lib/user-display";
import { formatNotificationContext } from "@/features/notifications/lib/format-notification-context";
import {
    formatNotificationAbsoluteTime,
    formatNotificationRelativeTime,
} from "@/features/notifications/lib/format-notification-time";
import { notificationKindIcon } from "@/features/notifications/lib/notification-kind-icon";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";

type NotificationItemProperties = {
    /** The row's Task is open in the drawer right now. */
    active?: boolean;
    notification: Notification;
    onOpen: () => void;
    onToggleRead: () => void;
    /** Shown next to the time; omit when every row is in one Project. */
    projectName?: string;
    toggleDisabled?: boolean;
};

/** One inbox row: who, what happened, which Task, where and when. */
export function NotificationItem({
    active = false,
    notification,
    onOpen,
    onToggleRead,
    projectName,
    toggleDisabled = false,
}: NotificationItemProperties) {
    const { i18n, t } = useTranslation("common");
    const isUnread = notification.readAt == undefined;
    const toggleLabel = isUnread
        ? t("notifications.markRead")
        : t("notifications.markUnread");
    const actorName = notificationActorName(notification.actor, t);
    const absoluteTime = formatNotificationAbsoluteTime(
        notification.createdAt,
        i18n.language
    );

    return (
        <li
            className={cn(
                "group relative",
                isUnread &&
                    "before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-0.5 before:bg-primary"
            )}
            data-testid="notification-item"
            data-unread={isUnread ? "true" : undefined}
        >
            <button
                aria-current={active ? "true" : undefined}
                className={cn(
                    "flex w-full gap-3 py-3 pr-12 pl-3 text-left transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                    isUnread ? "bg-muted/25" : "",
                    active && "bg-primary/10 hover:bg-primary/10"
                )}
                onClick={onOpen}
                type="button"
            >
                <NotificationAvatar
                    actor={notification.actor}
                    actorName={actorName}
                    isUnread={isUnread}
                    kind={notification.kind}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                        className={cn(
                            "text-sm wrap-anywhere",
                            isUnread
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                        )}
                    >
                        {isUnread ? (
                            <span className="sr-only">
                                {t("notifications.unreadLabel")}:{" "}
                            </span>
                        ) : undefined}
                        {formatNotificationContext(notification, t)}
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
                            {notification.taskKey}
                        </span>
                        <span className="text-muted-foreground">{" · "}</span>
                        {notification.taskTitle}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {actorName ? (
                            <>
                                <span
                                    className={cn(
                                        "min-w-0 truncate",
                                        isUnread && "text-foreground/80"
                                    )}
                                    data-testid="notification-actor"
                                >
                                    {actorName}
                                </span>
                                <span aria-hidden>·</span>
                            </>
                        ) : undefined}
                        {projectName ? (
                            <>
                                <span className="min-w-0 truncate">
                                    {projectName}
                                </span>
                                <span aria-hidden>·</span>
                            </>
                        ) : undefined}
                        <time
                            className="shrink-0"
                            dateTime={notification.createdAt}
                            title={absoluteTime}
                        >
                            {formatNotificationRelativeTime(
                                notification.createdAt,
                                {
                                    justNowLabel: t("notifications.justNow"),
                                    locale: i18n.language,
                                }
                            )}
                        </time>
                    </span>
                </span>
            </button>
            <Button
                aria-label={toggleLabel}
                className="absolute top-2.5 right-2 rounded-none text-muted-foreground hover:bg-primary/10 hover:text-primary"
                data-testid="notification-toggle-read"
                disabled={toggleDisabled}
                onClick={onToggleRead}
                size="icon-sm"
                title={toggleLabel}
                type="button"
                variant="ghost"
            >
                {isUnread ? <MailOpen /> : <Mail />}
            </Button>
        </li>
    );
}

function notificationActorName(
    actor: NotificationActor | null,
    t: (
        key: "notifications.githubActor" | "notifications.unknownActor"
    ) => string
): string {
    if (!actor) return "";
    if (actor.kind === "github") return t("notifications.githubActor");
    return actor.name || t("notifications.unknownActor");
}

/** Actor avatar with the kind icon as a corner badge; kind icon alone when no Actor. */
function NotificationAvatar({
    actor,
    actorName,
    isUnread,
    kind,
}: {
    actor: Notification["actor"];
    actorName: string;
    isUnread: boolean;
    kind: Notification["kind"];
}) {
    const KindIcon = notificationKindIcon(kind);

    if (!actor) {
        return (
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center border",
                    isUnread
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                )}
            >
                <KindIcon className="size-3.5" />
            </span>
        );
    }

    return (
        <span aria-hidden className="relative mt-0.5 size-8 shrink-0">
            <Avatar
                className={cn(
                    "size-8 rounded-none after:rounded-none",
                    !isUnread && "opacity-70"
                )}
            >
                {actor.kind === "user" && actor.avatarUrl ? (
                    <AvatarImage
                        alt=""
                        className="rounded-none"
                        src={actor.avatarUrl}
                    />
                ) : undefined}
                <AvatarFallback className="rounded-none text-meta">
                    {actor.kind === "github"
                        ? "GH"
                        : getUserInitials(actorName || "?")}
                </AvatarFallback>
            </Avatar>
            <span
                className={cn(
                    "absolute -right-1.5 -bottom-1.5 flex size-4 items-center justify-center border bg-(--notification-surface,var(--color-background))",
                    isUnread
                        ? "border-primary/50 text-primary"
                        : "border-border text-muted-foreground"
                )}
            >
                <KindIcon className="size-2.5" />
            </span>
        </span>
    );
}
