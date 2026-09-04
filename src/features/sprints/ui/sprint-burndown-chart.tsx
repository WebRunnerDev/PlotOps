import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SprintBurndownSeries } from "@/features/sprints/model/build-sprint-burndown-series";

import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { LineChart } from "@/components/charts/line-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Button } from "@/shared/shadcn/ui/button";
import { ButtonGroup } from "@/shared/shadcn/ui/button-group";

type ChartMode = "burndown" | "burnup";

export function SprintBurndownChart({
    mode,
    series,
}: {
    mode: "active" | "closed";
    series: SprintBurndownSeries;
}) {
    const { t } = useTranslation("board");
    const [chartMode, setChartMode] = useState<ChartMode>("burndown");

    const chartData = useMemo(() => {
        return series.days
            .filter((day) => day.remaining !== null)
            .map((day) => ({
                completedCumulative: day.completedCumulative ?? 0,
                date: parseIsoDateLocal(day.date),
                ideal: day.ideal,
                idealCompleted: day.idealCompleted,
                remaining: day.remaining ?? 0,
                scope: day.scope ?? 0,
            }));
    }, [series.days]);

    if (series.emptyReason) {
        return (
            <p className="text-ui text-muted-foreground">
                {t(`sprints.burndownEmpty.${series.emptyReason}`)}
            </p>
        );
    }

    if (series.days.length === 0 || chartData.length === 0) {
        return (
            <p className="text-ui text-muted-foreground">
                {t("sprints.burndownEmpty.missing_dates")}
            </p>
        );
    }

    const metricLabel =
        series.metric === "points"
            ? t(
                  chartMode === "burndown"
                      ? "sprints.burndownMetricPoints"
                      : "sprints.burnupMetricPoints"
              )
            : t(
                  chartMode === "burndown"
                      ? "sprints.burndownMetricCount"
                      : "sprints.burnupMetricCount"
              );

    return (
        <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                    <h3 className="text-ui font-medium">
                        {t(
                            chartMode === "burndown"
                                ? "sprints.burndownTitle"
                                : "sprints.burnupTitle"
                        )}
                    </h3>
                    <p className="text-meta text-muted-foreground">
                        {metricLabel}
                    </p>
                </div>
                <ButtonGroup aria-label={t("sprints.chartModeLabel")}>
                    <Button
                        onClick={() => setChartMode("burndown")}
                        size="xs"
                        type="button"
                        variant={
                            chartMode === "burndown" ? "default" : "outline"
                        }
                    >
                        {t("sprints.burndownTitle")}
                    </Button>
                    <Button
                        onClick={() => setChartMode("burnup")}
                        size="xs"
                        type="button"
                        variant={chartMode === "burnup" ? "default" : "outline"}
                    >
                        {t("sprints.burnupTitle")}
                    </Button>
                </ButtonGroup>
            </div>
            {series.metric === "points" && series.unestimatedCount > 0 ? (
                <p className="text-meta text-muted-foreground">
                    {t("sprints.burndownUnestimated", {
                        count: series.unestimatedCount,
                    })}
                </p>
            ) : null}
            {series.metric === "count" ? (
                <p className="text-meta text-muted-foreground">
                    {t("sprints.burndownCountFallback")}
                </p>
            ) : null}
            <div className="min-w-0 w-full">
                <LineChart
                    aspectRatio="2 / 1"
                    className="min-h-[160px] w-full"
                    data={chartData}
                    margin={{ bottom: 28, left: 40, right: 12, top: 16 }}
                    status="ready"
                >
                    <Grid horizontal />
                    {chartMode === "burndown" ? (
                        <>
                            <Line
                                dataKey="ideal"
                                fadeEdges={false}
                                showHighlight={false}
                                stroke="var(--chart-line-secondary)"
                                strokeWidth={1.5}
                            />
                            <Line
                                dataKey="remaining"
                                fadeEdges={false}
                                stroke="var(--chart-line-primary)"
                                strokeWidth={2}
                            />
                        </>
                    ) : (
                        <>
                            <Line
                                dataKey="idealCompleted"
                                fadeEdges={false}
                                showHighlight={false}
                                stroke="var(--chart-line-secondary)"
                                strokeWidth={1.5}
                            />
                            <Line
                                dataKey="scope"
                                fadeEdges={false}
                                stroke="var(--chart-3)"
                                strokeWidth={1.5}
                            />
                            <Line
                                dataKey="completedCumulative"
                                fadeEdges={false}
                                stroke="var(--chart-line-primary)"
                                strokeWidth={2}
                            />
                        </>
                    )}
                    <XAxis numTicks={Math.min(5, chartData.length)} />
                    <ChartTooltip />
                </LineChart>
            </div>
            <div className="flex flex-wrap gap-4 text-meta text-muted-foreground">
                {chartMode === "burndown" ? (
                    <>
                        <LegendSwatch
                            label={t("sprints.burndownIdeal")}
                            tone="secondary"
                        />
                        <LegendSwatch
                            label={t("sprints.burndownActual")}
                            tone="primary"
                        />
                    </>
                ) : (
                    <>
                        <LegendSwatch
                            label={t("sprints.burnupIdeal")}
                            tone="secondary"
                        />
                        <LegendSwatch
                            label={t("sprints.burnupScope")}
                            tone="muted"
                        />
                        <LegendSwatch
                            label={t("sprints.burnupCompleted")}
                            tone="primary"
                        />
                    </>
                )}
            </div>
            <p className="text-meta text-muted-foreground">
                {t(
                    mode === "active"
                        ? "sprints.burndownProxyHintActive"
                        : "sprints.burndownProxyHintClosed"
                )}
            </p>
        </div>
    );
}

function LegendSwatch({
    label,
    tone,
}: {
    label: string;
    tone: "muted" | "primary" | "secondary";
}) {
    const className =
        tone === "primary"
            ? "bg-primary"
            : tone === "secondary"
              ? "bg-muted-foreground"
              : "bg-chart-3";
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                aria-hidden
                className={`inline-block h-0.5 w-4 ${className}`}
            />
            {label}
        </span>
    );
}

function parseIsoDateLocal(isoDate: string): Date {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year!, month! - 1, day!);
}
