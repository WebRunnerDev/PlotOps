import type { ReactNode } from "react";

import type { FlowColumn } from "@/features/flow-reports/model/types";

import { resolveDoneColumnIndex } from "@/features/flow-reports/model/build-task-timelines";

export const DAY_MS = 86_400_000;

export function ChartTooltipBox({
    children,
    left,
    top,
    width,
}: {
    children: ReactNode;
    left: number;
    top: number;
    width: number;
}) {
    // Flip to the left of the pointer past the middle of the chart.
    const flip = left > width / 2;
    return (
        <div
            className="pointer-events-none absolute z-10 min-w-36 border border-border bg-popover px-2.5 py-2 text-sm text-popover-foreground shadow-md"
            style={{
                left: flip ? undefined : left + 12,
                right: flip ? width - left + 12 : undefined,
                top,
            }}
        >
            {children}
        </div>
    );
}

/**
 * Band colour per column: Done apart in green, the other stages along one
 * blue ramp from first to last (ordinal; validated light and dark).
 */
export function flowColumnColors(columns: ReadonlyArray<FlowColumn>): string[] {
    const doneIndex = resolveDoneColumnIndex(columns);
    const stages = columns.length - (doneIndex === -1 ? 0 : 1);
    let rank = 0;
    return columns.map((_, index) => {
        if (index === doneIndex) return "var(--chart-flow-done)";
        const step =
            stages <= 1 ? 3 : 1 + Math.round((rank * 4) / (stages - 1));
        rank += 1;
        return `var(--chart-flow-${step})`;
    });
}

/** "2,5 дня" / "5 ч" — days with one decimal under 10, hours under a day. */
export function formatCycleDuration(
    ms: number,
    locale: string | undefined,
    t: (key: string, options: Record<string, unknown>) => string
): string {
    const days = ms / DAY_MS;
    if (days < 1) {
        const hours = Math.max(1, Math.round(ms / 3_600_000));
        return t("flow.durationHours", { count: hours });
    }
    const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
    return t("flow.durationDays", {
        count: rounded,
        value: new Intl.NumberFormat(locale, {
            maximumFractionDigits: 1,
        }).format(rounded),
    });
}

export function formatShortDate(
    value: Date | number,
    locale: string | undefined
): string {
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
    }).format(value);
}

export function LegendSwatch({ color }: { color: string }) {
    return (
        <span
            aria-hidden
            className="inline-block size-2.5 shrink-0"
            style={{ backgroundColor: color }}
        />
    );
}
