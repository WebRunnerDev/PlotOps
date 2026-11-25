import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CycleTime } from "@/features/flow-reports/model/build-cycle-time";

import { ChartYValueAxis } from "@/components/charts/chart-y-value-axis";
import { Grid } from "@/components/charts/grid";
import { ReferenceLine } from "@/components/charts/reference-line";
import { Scatter, ScatterChart } from "@/components/charts/scatter-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import {
    DAY_MS,
    formatCycleDuration,
    formatShortDate,
} from "@/features/flow-reports/ui/flow-chart-parts";

const DAYS_KEY = "days";

/**
 * Cycle time per Task by completion date (Bklit ScatterChart), with the
 * median and the 85th percentile as reference lines. Clicking a point — or
 * focusing the chart, stepping with ← / → and pressing Enter — opens its
 * Task.
 */
export function CycleTimeChart({
    cycle,
    now,
    onOpenTask,
    since,
}: {
    cycle: CycleTime;
    now: Date;
    onOpenTask: (taskId: string) => void;
    since: Date;
}) {
    const { i18n, t } = useTranslation("board");
    const locale = i18n.resolvedLanguage;
    const format = (ms: number) => formatCycleDuration(ms, locale, t);

    const data = useMemo(
        () =>
            cycle.points
                .map((point) => ({
                    completedAt: point.completedAt,
                    date: new Date(point.completedAt),
                    [DAYS_KEY]: point.durationMs / DAY_MS,
                    durationMs: point.durationMs,
                    task: point.task,
                }))
                .toSorted((a, b) => a.date.getTime() - b.date.getTime()),
        [cycle.points]
    );
    const xDomain = useMemo<[Date, Date]>(() => [since, now], [since, now]);

    // Close lines: p85 labelled above its line, the median below its own.
    const medianDays = cycle.medianMs === null ? null : cycle.medianMs / DAY_MS;
    const p85Days = cycle.p85Ms === null ? null : cycle.p85Ms / DAY_MS;
    const maxDays = Math.max(1, ...data.map((point) => point[DAYS_KEY]));
    const linesClose =
        medianDays !== null &&
        p85Days !== null &&
        Math.abs(medianDays - p85Days) < maxDays * 0.08;

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span aria-hidden className="text-[11px] text-muted-foreground">
                {t("flow.axisDays")}
            </span>
            <ScatterChart
                aspectRatio="auto"
                className="h-72 w-full"
                data={data}
                label={`${t("flow.cycleChartLabel")}. ${t("flow.cycleChartKeys")}`}
                margin={{ bottom: 34, left: 40, right: 12, top: 12 }}
                onPointClick={(point) =>
                    onOpenTask((point.task as { id: string }).id)
                }
                xDomain={xDomain}
                yDomainMinTop={(p85Days ?? 0) * 1.1}
            >
                <Grid horizontal numTicksRows={4} />
                {medianDays === null ? null : (
                    <ReferenceLine
                        label={t("flow.medianShort", {
                            value: format(cycle.medianMs!),
                        })}
                        labelBelow={linesClose}
                        y={medianDays}
                    />
                )}
                {p85Days === null ? null : (
                    <ReferenceLine
                        label={t("flow.p85Short", {
                            value: format(cycle.p85Ms!),
                        })}
                        strokeDasharray="4 3"
                        y={p85Days}
                    />
                )}
                <Scatter
                    dataKey={DAYS_KEY}
                    fill="var(--chart-1)"
                    inactiveOpacity={0.35}
                    radius={5}
                    ringGap={2}
                    strokeWidth={1.5}
                />
                <ChartYValueAxis numTicks={4} />
                <XAxis
                    numTicks={Math.min(6, Math.max(2, data.length))}
                    tickMode="domain"
                />
                <ChartTooltip
                    backgroundColor="var(--popover)"
                    content={({ point }) => {
                        const task = point.task as {
                            key: string;
                            title: string;
                        };
                        return (
                            <div className="flex max-w-72 flex-col gap-1 px-3 py-2.5 text-sm">
                                <p className="line-clamp-2 font-medium text-chart-tooltip-foreground">
                                    <span className="text-chart-tooltip-muted">
                                        {task.key}
                                    </span>{" "}
                                    {task.title}
                                </p>
                                <p className="flex items-center gap-2 tabular-nums text-chart-tooltip-foreground">
                                    <span
                                        aria-hidden
                                        className="size-2.5 shrink-0 rounded-full bg-chart-1"
                                    />
                                    {t("flow.cycleTimeValue", {
                                        value: format(Number(point.durationMs)),
                                    })}
                                </p>
                                <p className="text-chart-tooltip-muted">
                                    {t("flow.completedOn", {
                                        date: formatShortDate(
                                            Number(point.completedAt),
                                            locale
                                        ),
                                    })}
                                </p>
                            </div>
                        );
                    }}
                    showCrosshair={false}
                    showDatePill={false}
                    showDots={false}
                />
            </ScatterChart>
        </div>
    );
}
