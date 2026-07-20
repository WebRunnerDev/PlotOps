import type { CSSProperties } from "react";

import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    TaskPriority,
    TaskType,
} from "./types";

/** Default statuses — each is a kanban column. Names are editable on the board. */
export const DEFAULT_KANBAN_COLUMNS: BoardColumn[] = [
    { id: "todo", name: "To Do" },
    { id: "in_progress", name: "In Progress" },
    { id: "in_review", name: "In Review" },
    { id: "done", name: "Done" },
];

export const KANBAN_COLUMNS = DEFAULT_KANBAN_COLUMNS;

export const TASK_TYPES: TaskType[] = ["task", "bug", "feature"];

export const TASK_PRIORITIES: TaskPriority[] = [
    "urgent",
    "high",
    "medium",
    "low",
];

export const LABEL_COLORS: LabelColor[] = [
    "red",
    "orange",
    "amber",
    "green",
    "cyan",
    "blue",
    "purple",
    "pink",
    "gray",
];

export const LABEL_COLOR_CLASS: Record<LabelColor, string> = {
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30",
    blue: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30",
    cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-cyan-500/30",
    gray: "bg-muted text-muted-foreground ring-foreground/15",
    green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
    orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-orange-500/30",
    pink: "bg-pink-500/15 text-pink-600 dark:text-pink-400 ring-pink-500/30",
    purple: "bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-violet-500/30",
    red: "bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30",
};

export const LABEL_DOT_CLASS: Record<LabelColor, string> = {
    amber: "bg-amber-500",
    blue: "bg-sky-500",
    cyan: "bg-cyan-500",
    gray: "bg-muted-foreground",
    green: "bg-emerald-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    purple: "bg-violet-500",
    red: "bg-red-500",
};

/** Matches `#rgb` or `#rrggbb`. Custom label colors are stored as hex. */
export const HEX_COLOR_PATTERN = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

export function isValidHexColor(value: string): boolean {
    return HEX_COLOR_PATTERN.test(value.trim());
}

type LabelColorInput = Pick<ProjectLabel, "color" | "customColor">;

type ColorRender = { className?: string; style?: CSSProperties };

/** Dot swatch styling — inline color when custom, preset class otherwise. */
export function getLabelDotProps(label: LabelColorInput): ColorRender {
    if (label.customColor) {
        return { style: { backgroundColor: label.customColor } };
    }
    return { className: LABEL_DOT_CLASS[label.color] };
}

/** Chip/badge styling — translucent fill + ring derived from the hex when custom. */
export function getLabelChipProps(label: LabelColorInput): ColorRender {
    if (label.customColor) {
        const hex = label.customColor;
        return {
            style: {
                backgroundColor: `${hex}26`,
                boxShadow: `inset 0 0 0 1px ${hex}4d`,
                color: hex,
            },
        };
    }
    return { className: LABEL_COLOR_CLASS[label.color] };
}

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
    high: "text-orange-500",
    low: "text-muted-foreground",
    medium: "text-sky-500",
    urgent: "text-red-500",
};
