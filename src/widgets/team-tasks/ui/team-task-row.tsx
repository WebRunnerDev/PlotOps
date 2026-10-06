import { Link } from "@tanstack/react-router";
import { Calendar, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    formatDeadline,
    isDeadlineOverdue,
    PRIORITY_DOT_CLASS,
    TaskTypeIcon,
    type TeamTask,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";

/**
 * Desktop column track shared by the header and every row:
 * key · title · Project · Board · status · Assignee · Priority · Deadline.
 */
export const TEAM_TASK_GRID_CLASS =
    "lg:grid lg:grid-cols-[6rem_minmax(0,1fr)_8rem_6rem_7rem_8rem_5.5rem_5rem] lg:items-center lg:gap-3";

type TeamTaskRowProperties = {
    task: TeamTask;
};

/** One Team Tasks row — a link into the Task on its own Project's Board. */
export function TeamTaskRow({ task }: TeamTaskRowProperties) {
    const { i18n, t } = useTranslation("board");
    const overdue =
        Boolean(task.deadline) &&
        !task.isDone &&
        isDeadlineOverdue(task.deadline ?? "");

    return (
        <Link
            aria-label={t("teamTasks.openTask", {
                key: task.key,
                title: task.title,
            })}
            className={cn(
                "flex flex-col gap-1.5 px-3 py-2.5 outline-none hover:bg-primary/8 focus-visible:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:py-2",
                TEAM_TASK_GRID_CLASS
            )}
            params={{ boardId: task.boardId, projectId: task.projectId }}
            search={{ task: task.key }}
            to="/projects/$projectId/boards/$boardId"
        >
            <span className="flex min-w-0 items-start gap-2 lg:contents">
                <span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5 lg:pt-0">
                    <TaskTypeIcon type={task.type} />
                    <span className="text-code text-muted-foreground">
                        {task.key}
                    </span>
                </span>
                <span
                    className={cn(
                        "min-w-0 text-ui wrap-break-word lg:truncate",
                        task.isDone && "text-muted-foreground line-through"
                    )}
                >
                    {task.title}
                </span>
            </span>

            {/* `text-ui`, not `text-meta`: names and dates are read, not
                scanned as labels — the mono caps made them illegible. */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-ui text-foreground/85 lg:contents">
                <span className="min-w-0 truncate text-muted-foreground">
                    {task.projectName}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                    {task.boardName}
                </span>
                <span className="min-w-0">
                    <span className="inline-block max-w-full truncate border border-border bg-muted px-1.5 py-0.5 align-middle text-foreground">
                        {task.statusName}
                    </span>
                </span>

                <span
                    className={cn(
                        "inline-flex min-w-0 items-center gap-1.5",
                        !task.assignee &&
                            "hidden text-muted-foreground lg:inline-flex"
                    )}
                >
                    <Avatar size="sm">
                        {task.assignee?.avatarUrl ? (
                            <AvatarImage alt="" src={task.assignee.avatarUrl} />
                        ) : undefined}
                        <AvatarFallback className="text-meta">
                            {task.assignee ? (
                                initials(task.assignee.name)
                            ) : (
                                <User className="size-3" />
                            )}
                        </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate">
                        {task.assignee?.name ?? t("fields.memberNone")}
                    </span>
                </span>

                <span
                    className={cn(
                        "inline-flex min-w-0 items-center gap-1.5",
                        !task.priority && "hidden lg:inline-flex"
                    )}
                >
                    {task.priority ? (
                        <>
                            <span
                                aria-hidden
                                className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    PRIORITY_DOT_CLASS[task.priority]
                                )}
                            />
                            <span className="truncate">
                                {t(`priority.${task.priority}`)}
                            </span>
                        </>
                    ) : (
                        <span aria-hidden className="text-muted-foreground">
                            —
                        </span>
                    )}
                </span>

                <span
                    className={cn(
                        "inline-flex min-w-0 items-center gap-1 tabular-nums",
                        overdue && "text-destructive",
                        !task.deadline && "hidden lg:inline-flex"
                    )}
                >
                    {task.deadline ? (
                        <>
                            <Calendar
                                aria-hidden
                                className="size-3.5 shrink-0"
                            />
                            <span className="truncate">
                                {formatDeadline(task.deadline, i18n.language)}
                            </span>
                            {overdue ? (
                                <span className="sr-only">
                                    {t("filters.deadline.overdue")}
                                </span>
                            ) : undefined}
                        </>
                    ) : (
                        <span aria-hidden className="text-muted-foreground">
                            —
                        </span>
                    )}
                </span>
            </span>
        </Link>
    );
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}
