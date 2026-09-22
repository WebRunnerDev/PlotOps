import type { EpicColor, TaskPriority, TaskType } from "./types";

/** Every Task type, hierarchy order (Epic first). */
export const TASK_TYPES: TaskType[] = ["epic", "story", "task", "bug"];

/**
 * Level-0 types — quick-add, Board default, Subtasks. Epics are created
 * deliberately (Manager+) from the Backlog Epics panel, palette, or drawer.
 */
export const WORK_ITEM_TASK_TYPES: TaskType[] = ["story", "task", "bug"];

export const EPIC_COLORS: EpicColor[] = [
    "purple",
    "blue",
    "teal",
    "green",
    "yellow",
    "orange",
    "red",
    "pink",
    "gray",
];

/** Default colour for a new Epic when none is picked. */
export const DEFAULT_EPIC_COLOR: EpicColor = "purple";

/** Solid swatch per Epic colour (dots, colour picker). */
export const EPIC_COLOR_SWATCH_CLASS: Record<EpicColor, string> = {
    blue: "bg-blue-500",
    gray: "bg-zinc-500",
    green: "bg-emerald-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    purple: "bg-violet-500",
    red: "bg-red-500",
    teal: "bg-teal-500",
    yellow: "bg-amber-400",
};

/** Tinted chip per Epic colour (card / list badges). */
export const EPIC_COLOR_BADGE_CLASS: Record<EpicColor, string> = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    gray: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    pink: "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    purple: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    teal: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    yellow: "border-amber-500/30 bg-amber-400/15 text-amber-800 dark:text-amber-300",
};

export const TASK_PRIORITIES: TaskPriority[] = [
    "urgent",
    "high",
    "medium",
    "low",
];

/** Default priority for newly created tasks. */
export const DEFAULT_TASK_PRIORITY: TaskPriority = "medium";

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
    high: "text-orange-500",
    low: "text-muted-foreground",
    medium: "text-sky-500",
    urgent: "text-red-500",
};

/** Compact priority marker for Make-style task cards. */
export const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
    high: "bg-orange-500",
    low: "bg-muted-foreground/70",
    medium: "bg-sky-500",
    urgent: "bg-red-500",
};

/** Left rail (via `before:`) accent per priority on kanban cards. */
export const PRIORITY_RAIL_CLASS: Record<TaskPriority, string> = {
    high: "before:bg-orange-500",
    low: "before:bg-muted-foreground/45",
    medium: "before:bg-sky-500",
    urgent: "before:bg-red-500",
};

/** @deprecated Type is shown via icon; prefer {@link PRIORITY_RAIL_CLASS} on cards. */
export const TASK_TYPE_CARD_CLASS: Record<TaskType, string> = {
    bug: "before:bg-destructive",
    epic: "before:bg-violet-500",
    story: "before:bg-success",
    task: "before:bg-primary",
};

export const TASK_TYPE_ICON_CLASS: Record<TaskType, string> = {
    bug: "text-destructive",
    epic: "text-violet-500",
    story: "text-success",
    task: "text-primary",
};

/** Column header accent squares (Make kanban). */
export const COLUMN_ACCENT_CLASS = [
    "bg-muted-foreground/55",
    "bg-sky-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
] as const;

export function columnAccentClass(seed: string): string {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + (seed.codePointAt(index) ?? 0)) >>> 0;
    }
    return COLUMN_ACCENT_CLASS[hash % COLUMN_ACCENT_CLASS.length]!;
}

/** Max task title length (Jira / GitHub issue title cap). */
export const TASK_TITLE_MAX_LENGTH = 255;

/** Max stored HTML length for task descriptions (~128 KiB). */
export const TASK_DESCRIPTION_MAX_LENGTH = 131_072;

/** Max stored HTML length for a single task comment (~32 KiB). */
export const TASK_COMMENT_MAX_LENGTH = 32_768;

/** Soft UI cap for activity feed rows (SPEC: last 50–100). */
export const TASK_ACTIVITY_FEED_LIMIT = 100;
