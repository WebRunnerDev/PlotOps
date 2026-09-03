import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { Grid } from "@/components/charts/grid";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import { buildSprintKpis } from "@/features/sprints/model/build-sprint-kpis";

type SprintInsightsPanelProperties = {
    sprints: readonly Sprint[];
    tasks: ReadonlyArray<{ estimate?: null | number; id: string }>;
};

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

    const ringData = useMemo(() => {
        if (accuracyPercent === null) return [];
        return [
            {
                color: "var(--chart-1)",
                label: t("sprints.insightsAccuracyLabel"),
                maxValue: 100,
                value: accuracyPercent,
            },
        ];
    }, [accuracyPercent, t]);

    return (
        <section className="rounded-md border border-border bg-card">
            <header className="border-b border-border px-3 py-2">
                <h2 className="text-h3">{t("sprints.insightsTitle")}</h2>
                <p className="text-meta text-muted-foreground">
                    {t("sprints.insightsSubtitle", {
                        count: kpis.windowSize,
                    })}
                </p>
            </header>
            <div className="space-y-3 px-3 py-3">
                {kpis.emptyReason ? (
                    <p className="text-ui text-muted-foreground">
                        {t(`sprints.insightsEmpty.${kpis.emptyReason}`)}
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="min-w-0 space-y-1">
                                <p className="text-meta text-muted-foreground">
                                    {t("sprints.insightsVelocityLabel")}
                                </p>
                                <p className="text-h3 tabular-nums">
                                    {kpis.velocity === null
                                        ? "—"
                                        : t(
                                              kpis.metric === "points"
                                                  ? "sprints.insightsVelocityPoints"
                                                  : "sprints.insightsVelocityCount",
                                              { value: kpis.velocity }
                                          )}
                                </p>
                                <p className="text-meta text-muted-foreground">
                                    {t("sprints.insightsSample", {
                                        count: kpis.sampleSize,
                                    })}
                                </p>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="text-meta text-muted-foreground">
                                    {t("sprints.insightsAccuracyLabel")}
                                </p>
                                <p className="text-h3 tabular-nums">
                                    {accuracyPercent === null
                                        ? "—"
                                        : t("sprints.insightsAccuracyValue", {
                                              percent: accuracyPercent,
                                          })}
                                </p>
                                <p className="text-meta text-muted-foreground">
                                    {t("sprints.insightsAccuracyHint")}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="min-w-0 space-y-2">
                                <p className="text-meta text-muted-foreground">
                                    {t("sprints.insightsVelocityChart")}
                                </p>
                                <BarChart
                                    aspectRatio="2 / 1"
                                    className="min-h-[140px] w-full"
                                    data={barData}
                                    margin={{
                                        bottom: 36,
                                        left: 36,
                                        right: 12,
                                        top: 16,
                                    }}
                                    status="ready"
                                    xDataKey="name"
                                >
                                    <Grid horizontal />
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
                                    <BarXAxis />
                                    <ChartTooltip />
                                </BarChart>
                                <div className="flex flex-wrap gap-4 text-meta text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            aria-hidden
                                            className="inline-block size-2 bg-chart-3"
                                        />
                                        {t("sprints.insightsCommittedBar")}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            aria-hidden
                                            className="inline-block size-2 bg-chart-1"
                                        />
                                        {t("sprints.insightsCompletedBar")}
                                    </span>
                                </div>
                            </div>

                            {ringData.length > 0 ? (
                                <div className="mx-auto flex w-full max-w-[180px] flex-col items-center gap-2">
                                    <RingChart
                                        className="aspect-square w-full"
                                        data={ringData}
                                        size={160}
                                        strokeWidth={14}
                                    >
                                        <Ring index={0} showGlow={false} />
                                        <RingCenter
                                            defaultLabel={t(
                                                "sprints.insightsAccuracyLabel"
                                            )}
                                            suffix="%"
                                        />
                                    </RingChart>
                                </div>
                            ) : null}
                        </div>
                    </>
                )}
                {kpis.metric === "count" && !kpis.emptyReason ? (
                    <p className="text-meta text-muted-foreground">
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
