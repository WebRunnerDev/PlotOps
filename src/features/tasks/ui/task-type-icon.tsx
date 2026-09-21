import type { LucideIcon } from "lucide-react";

import { Bookmark, Bug, CheckSquare, Zap } from "lucide-react";

import type { TaskType } from "@/features/tasks/model/types";

import { TASK_TYPE_ICON_CLASS } from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";

/** Jira-like glyph per Task type (Epic ⚡, Story 🔖, Task ☑, Bug 🐞). */
export const TASK_TYPE_ICON: Record<TaskType, LucideIcon> = {
    bug: Bug,
    epic: Zap,
    story: Bookmark,
    task: CheckSquare,
};

export function TaskTypeIcon({
    className,
    label,
    type,
}: {
    className?: string;
    /** Accessible name; omit when adjacent text already names the type. */
    label?: string;
    type: TaskType;
}) {
    const Icon = TASK_TYPE_ICON[type];
    return (
        <Icon
            aria-hidden={label === undefined || undefined}
            aria-label={label}
            className={cn(
                "size-3.5 shrink-0",
                TASK_TYPE_ICON_CLASS[type],
                className
            )}
        />
    );
}
