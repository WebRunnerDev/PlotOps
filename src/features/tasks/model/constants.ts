import type { TaskPriority, TaskType } from "./types";

/** @deprecated Import from `@/features/boards` — temporary shim. */
export {
    DEFAULT_KANBAN_COLUMNS,
    KANBAN_COLUMNS,
} from "@/features/boards/model/constants";

export const TASK_TYPES: TaskType[] = ["task", "bug", "feature"];

export const TASK_PRIORITIES: TaskPriority[] = [
    "urgent",
    "high",
    "medium",
    "low",
];

/** @deprecated Import from `@/features/labels` — temporary shim. */
export {
    getLabelChipProperties,
    getLabelDotProperties,
    HEX_COLOR_PATTERN,
    isValidHexColor,
    LABEL_COLOR_CLASS,
    LABEL_COLORS,
    LABEL_DOT_CLASS,
} from "@/features/labels/model/constants";

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

/** Max stored HTML length for task descriptions (~128 KiB). */
export const TASK_DESCRIPTION_MAX_LENGTH = 131_072;

/** Max stored HTML length for a single task comment (~32 KiB). */
export const TASK_COMMENT_MAX_LENGTH = 32_768;

/** Soft UI cap for activity feed rows (SPEC: last 50–100). */
export const TASK_ACTIVITY_FEED_LIMIT = 100;
