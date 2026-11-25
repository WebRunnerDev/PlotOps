import type { ReactNode } from "react";

import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { FlowColumn } from "@/features/flow-reports/model/types";

import { resolveDoneColumnIndex } from "@/features/flow-reports/model/build-task-timelines";
import { cn } from "@/shared/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";

export const DAY_MS = 86_400_000;

/**
 * "Show as table" disclosure under a flow chart: the same numbers for
 * screen readers and exact reading, scrolled inside the project's thin
 * scrollbar with a sticky header.
 */
export function FlowDataTable({ children }: { children: ReactNode }) {
    const { t } = useTranslation("board");
    return (
        <Collapsible className="text-sm">
            <CollapsibleTrigger className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <ChevronRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-200 ease-(--ease-out-expo) group-data-panel-open:rotate-90"
                />
                {t("flow.showTable")}
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="scrollbar-board mt-2 max-h-72 overflow-auto overscroll-contain border border-border">
                    <table className="w-full border-collapse text-left tabular-nums">
                        {children}
                    </table>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/** Table header row cell styling shared by both flow tables. */
export const flowTableHeadClassName =
    "sticky top-0 z-10 border-b border-border bg-muted text-meta text-muted-foreground";

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

export function LegendSwatch({
    color,
    outlined = false,
}: {
    color: string;
    outlined?: boolean;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-block size-2.5 shrink-0",
                outlined && "border border-muted-foreground/60"
            )}
            style={{ backgroundColor: color }}
        />
    );
}
