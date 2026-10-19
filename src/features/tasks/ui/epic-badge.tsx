import type { EpicColor } from "@/features/tasks/model/types";

import {
    DEFAULT_EPIC_COLOR,
    EPIC_COLOR_BADGE_CLASS,
    EPIC_COLOR_SWATCH_CLASS,
} from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";

/** Coloured Epic chip shown on cards, rows, and the drawer Epic field. */
export function EpicBadge({
    className,
    color,
    title,
    tooltip,
}: {
    className?: string;
    color?: EpicColor;
    title: string;
    tooltip?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex max-w-full min-w-0 items-center rounded-sm border px-1.5 py-px text-[0.625rem] font-medium leading-4",
                EPIC_COLOR_BADGE_CLASS[color ?? DEFAULT_EPIC_COLOR],
                className
            )}
            title={tooltip ?? title}
        >
            <span className="truncate">{title}</span>
        </span>
    );
}

export function EpicColorDot({
    className,
    color,
}: {
    className?: string;
    color?: EpicColor;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-block size-2.5 shrink-0 rounded-full",
                EPIC_COLOR_SWATCH_CLASS[color ?? DEFAULT_EPIC_COLOR],
                className
            )}
        />
    );
}
