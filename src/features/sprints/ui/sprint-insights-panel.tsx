import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartYValueAxis } from "@/components/charts/chart-y-value-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { buildSprintKpis } from "@/features/sprints/model/build-sprint-kpis";

type SprintInsightsPanelProperties = {
    sprints: readonly Sprint[];
    tasks: ReadonlyArray<{ estimate?: null | number; id: string }>;
};

/** Cap bar group width so a single sprint does not stretch wall-to-wall. */
const MAX_BAR_GROUP_WIDTH_PX = 56;

export function SprintInsightsPanel({
    sprints,
    tasks,
}: SprintInsightsPanelProperties) {
    const { t } = useTranslation("board");
    const kpis = useMemo(() => {
        const closedSprints = sprints
            .filter((sprint) => sprint.state === "closed")
            .map((sprint) => ({
                closedAt: sprint.closedAt,
                committedTaskIds: sprint.committedTaskIds,
                completedTaskIds: sprint.completedTaskIds,
                id: sprint.id,
                name: sprint.name,
            }));
        return buildSprintKpis({ closedSprints, tasks });
    }, [sprints, tasks]);

    const barData = useMemo(
        () =>
            kpis.velocitySeries.map((point) => ({
                committed: point.committed,
                completed: point.completed,
                name: truncateLabel(point.label),
            })),
        [kpis.velocitySeries]
    );

    const accuracyPercent =
        kpis.commitmentAccuracy === null
            ? null
            : Math.round(kpis.commitmentAccuracy * 100);

    const barWidth =
        barData.length > 0 && barData.length < 4
            ? MAX_BAR_GROUP_WIDTH_PX
            : undefined;

    const chartMaxWidthClass =
        barData.length <= 1
            ? "max-w-xs"
            : barData.length <= 3
              ? "max-w-md"
              : "w-full";

    return (
        <section className="overflow-hidden rounded-none border border-border bg-card/50 shadow-[inset_3px_0_0_0_color-mix(in_oklab,var(--primary)_35%,transparent)]">
            <header className="border-b border-border/80 px-3 py-3 sm:px-4">
                <h2 className="text-h3">{t("sprints.insightsTitle")}</h2>
                <p className="mt-1 text-ui text-muted-foreground">
                    {kpis.emptyReason
                        ? t("sprints.insightsSubtitle", {
                              count: kpis.windowSize,
                          })
                        : t("sprints.insightsSubtitleSampled", {
                              sample: kpis.sampleSize,
                              window: kpis.windowSize,
                          })}
                </p>
            </header>
            <div className="space-y-4 px-3 py-4 sm:px-4">
                {kpis.emptyReason ? (
                    <p className="text-ui text-muted-foreground">
                        {t(`sprints.insightsEmpty.${kpis.emptyReason}`)}
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-px overflow-hidden border border-primary/20 bg-primary/20 sm:grid-cols-2">
                            <div className="min-w-0 space-y-1 bg-background/90 px-3 py-3">
                                <p className="text-sm text-muted-foreground">
                                    {t("sprints.insightsVelocityLabel")}
                                </p>
                                <p className="font-heading text-h2 tabular-nums tracking-tight">
                                    {kpis.velocity === null
                                        ? "—"
                                        : t(
                                              kpis.metric === "points"
                                                  ? "sprints.insightsVelocityPoints"
                                                  : "sprints.insightsVelocityCount",
                                              { value: kpis.velocity }
                                          )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("sprints.insightsSample", {
                                        count: kpis.sampleSize,
                                    })}
                                </p>
                            </div>
                            <div className="min-w-0 space-y-1 bg-background/90 px-3 py-3">
                                <p className="text-sm text-muted-foreground">
                                    {t("sprints.insightsAccuracyLabel")}
                                </p>
                                <p className="font-heading text-h2 tabular-nums tracking-tight">
                                    {accuracyPercent === null
                                        ? "—"
                                        : t("sprints.insightsAccuracyValue", {
                                              percent: accuracyPercent,
                                          })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("sprints.insightsAccuracyHint")}
                                </p>
                            </div>
                        </div>

                        <div className="min-w-0 space-y-2">
                            <p className="text-sm text-muted-foreground">
                                {t("sprints.insightsVelocityChart")}
                            </p>
                            <div className={chartMaxWidthClass}>
                                <BarChart
                                    aspectRatio="2 / 1"
                                    barGap={0.35}
                                    barWidth={barWidth}
                                    className="min-h-[140px] w-full"
                                    data={barData}
                                    margin={{
                                        bottom: 28,
                                        left: 36,
                                        right: 12,
                                        top: 16,
                                    }}
                                    status="ready"
                                    xDataKey="name"
                                >
                                    <Grid horizontal numTicksRows={4} />
                                    <Bar
                                        dataKey="committed"
                                        fill="var(--chart-3)"
                                        lineCap="butt"
                                    />
                                    <Bar
                                        dataKey="completed"
                                        fill="var(--chart-1)"
                                        lineCap="butt"
                                    />
                                    <ChartYValueAxis numTicks={4} />
                                    <BarXAxis />
                                    <ChartTooltip
                                        backgroundColor="var(--popover)"
                                        rows={(point) => [
                                            {
                                                color: "var(--chart-3)",
                                                label: t(
                                                    "sprints.insightsCommittedBar"
                                                ),
                                                value: Number(
                                                    point.committed ?? 0
                                                ),
                                            },
                                            {
                                                color: "var(--chart-1)",
                                                label: t(
                                                    "sprints.insightsCompletedBar"
                                                ),
                                                value: Number(
                                                    point.completed ?? 0
                                                ),
                                            },
                                        ]}
                                        showDatePill={false}
                                        showDots={false}
                                    />
                                </BarChart>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <span
                                        aria-hidden
                                        className="inline-block size-2.5 bg-chart-3"
                                    />
                                    {t("sprints.insightsCommittedBar")}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span
                                        aria-hidden
                                        className="inline-block size-2.5 bg-chart-1"
                                    />
                                    {t("sprints.insightsCompletedBar")}
                                </span>
                            </div>
                        </div>
                    </>
                )}
                {kpis.metric === "count" && !kpis.emptyReason ? (
                    <p className="text-sm text-muted-foreground">
                        {t("sprints.insightsCountFallback")}
                    </p>
                ) : null}
            </div>
        </section>
    );
}

function truncateLabel(label: string): string {
    if (label.length <= 14) return label;
    return `${label.slice(0, 13)}…`;
}
