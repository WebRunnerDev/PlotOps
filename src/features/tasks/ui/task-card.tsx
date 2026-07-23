import type { LucideIcon } from "lucide-react";

import {
    Bug,
    Calendar,
    CheckSquare,
    GitBranch,
    Sparkles,
    User,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";
import type { Task, TaskType } from "@/features/tasks/model/types";

import { TaskLabelChips } from "@/features/labels";
import {
    formatBranchName,
    isSharedBranch,
} from "@/features/tasks/lib/format-branch";
import {
    formatDeadline,
    isDeadlineOverdue,
} from "@/features/tasks/lib/format-deadline";
import {
    PRIORITY_DOT_CLASS,
    TASK_TYPE_CARD_CLASS,
    TASK_TYPE_ICON_CLASS,
} from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/shadcn/ui/tooltip";

const TASK_TYPE_ICON: Record<TaskType, LucideIcon> = {
    bug: Bug,
    feature: Sparkles,
    task: CheckSquare,
};

type TaskCardProperties = {
    labels: ProjectLabel[];
    task: Task;
};

export function TaskCard({ labels, task }: TaskCardProperties) {
    const { i18n, t } = useTranslation("board");
    const assigneeName = task.assignee?.name;
    const overdue =
        task.deadline !== undefined && isDeadlineOverdue(task.deadline);
    const shared = task.branchName ? isSharedBranch(task.branchName) : false;
    const TypeIcon = TASK_TYPE_ICON[task.type];
    const typeLabel = t(`taskType.${task.type}`);

    return (
        <Card
            className={cn(
                "relative cursor-grab ring-0 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:content-[''] active:cursor-grabbing",
                TASK_TYPE_CARD_CLASS[task.type]
            )}
            size="sm"
        >
            <CardHeader className="gap-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        <TypeIcon
                            aria-label={typeLabel}
                            className={cn(
                                "size-3 shrink-0",
                                TASK_TYPE_ICON_CLASS[task.type]
                            )}
                        />
                        {task.priority ? (
                            <span
                                aria-hidden
                                className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    PRIORITY_DOT_CLASS[task.priority]
                                )}
                            />
                        ) : undefined}
                        <span className="truncate text-meta text-muted-foreground">
                            {task.key}
                        </span>
                    </span>
                    {task.pr ? (
                        <a
                            aria-label={t("prLink", {
                                number: task.pr.number,
                                state: t(`prState.${task.pr.state}`),
                            })}
                            className="shrink-0 text-code text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            href={task.pr.url}
                            onClick={(event) => {
                                event.stopPropagation();
                            }}
                            onPointerDown={(event) => {
                                event.stopPropagation();
                            }}
                            rel="noreferrer"
                            target="_blank"
                        >
                            PR #{task.pr.number}
                        </a>
                    ) : undefined}
                </div>

                <CardTitle className="line-clamp-2 text-ui font-semibold leading-snug text-foreground">
                    {task.title}
                </CardTitle>

                {task.branchName ? (
                    <TooltipProvider delay={200}>
                        <Tooltip>
                            <TooltipTrigger
                                className={cn(
                                    "inline-flex min-w-0 max-w-full cursor-default items-center gap-1.5 text-code",
                                    shared
                                        ? "text-muted-foreground/70"
                                        : "text-muted-foreground"
                                )}
                                render={<span />}
                            >
                                <GitBranch
                                    aria-hidden
                                    className="size-3 shrink-0"
                                />
                                <span className="truncate">
                                    {formatBranchName(task.branchName)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                {shared
                                    ? `${task.branchName} · ${t("github.sharedBranchTitle")}`
                                    : task.branchName}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : undefined}

                {labels.length > 0 ? (
                    <TaskLabelChips labels={labels} />
                ) : undefined}
            </CardHeader>

            <CardContent className="flex items-center justify-between gap-2 pt-0">
                {task.deadline ? (
                    <span
                        className={cn(
                            "inline-flex min-w-0 items-center gap-1 text-code",
                            overdue
                                ? "text-destructive"
                                : "text-muted-foreground"
                        )}
                    >
                        <Calendar aria-hidden className="size-3 shrink-0" />
                        <span className="truncate">
                            {formatDeadline(task.deadline, i18n.language)}
                        </span>
                    </span>
                ) : (
                    <span />
                )}

                <Avatar size="sm">
                    {task.assignee?.avatarUrl ? (
                        <AvatarImage
                            alt={assigneeName ?? ""}
                            src={task.assignee.avatarUrl}
                        />
                    ) : undefined}
                    <AvatarFallback className="text-meta">
                        {assigneeName ? (
                            initials(assigneeName)
                        ) : (
                            <User className="size-3" />
                        )}
                    </AvatarFallback>
                </Avatar>
            </CardContent>
        </Card>
    );
}

function initials(name: string): string {
    const parts = name
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}
