import { Calendar, Flag, GitBranch, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel, Task } from "@/features/tasks/model/types";

import { formatDeadline, isDeadlineOverdue } from "@/features/tasks/lib/format-deadline";
import { PRIORITY_CLASS } from "@/features/tasks/model/constants";
import { GithubTaskMeta } from "@/features/tasks/ui/github-task-meta";
import { TaskLabelChips } from "@/features/tasks/ui/task-label-chips";
import { cn } from "@/shared/lib/utils";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/shadcn/ui/avatar";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";

type TaskCardProperties = {
    labels: ProjectLabel[];
    task: Task;
};

export function TaskCard({ labels, task }: TaskCardProperties) {
    const { i18n, t } = useTranslation("board");
    const assigneeName = task.assignee?.name;
    const hasGithubMeta = Boolean(task.branchName || task.pr);
    const overdue =
        task.deadline !== undefined && isDeadlineOverdue(task.deadline);

    return (
        <Card
            className="cursor-grab transition-colors hover:ring-primary/40 active:cursor-grabbing"
            size="sm"
        >
            <CardHeader className="gap-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-meta font-mono text-muted-foreground">
                        {task.key}
                    </span>
                    {task.priority ? (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-meta",
                                PRIORITY_CLASS[task.priority],
                            )}
                        >
                            <Flag aria-hidden className="size-3" />
                            {t(`priority.${task.priority}`)}
                        </span>
                    ) : undefined}
                </div>
                <CardTitle className="line-clamp-2 text-ui leading-snug">
                    {task.title}
                </CardTitle>
                {labels.length > 0 ? (
                    <TaskLabelChips labels={labels} />
                ) : undefined}
            </CardHeader>

            <CardContent className="flex items-center justify-between gap-2 pt-0">
                <div className="flex min-w-0 items-center gap-2">
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

                    {task.deadline ? (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 text-code",
                                overdue
                                    ? "text-red-500"
                                    : "text-muted-foreground",
                            )}
                        >
                            <Calendar aria-hidden className="size-3 shrink-0" />
                            {formatDeadline(task.deadline, i18n.language)}
                        </span>
                    ) : undefined}
                </div>

                {hasGithubMeta ? (
                    <GithubTaskMeta branchName={task.branchName} pr={task.pr} />
                ) : (
                    <span className="inline-flex items-center gap-1 text-code text-muted-foreground/50">
                        <GitBranch aria-hidden className="size-3 shrink-0" />
                        <span>—</span>
                    </span>
                )}
            </CardContent>
        </Card>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/[\s_-]+/).filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}
