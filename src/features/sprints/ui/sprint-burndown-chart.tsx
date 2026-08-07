import { useTranslation } from "react-i18next";

import type { SprintBurndownSeries } from "@/features/sprints/model/build-sprint-burndown-series";

const WIDTH = 480;
const HEIGHT = 160;
const PAD = { bottom: 28, left: 36, right: 12, top: 12 };

export function SprintBurndownChart({
    mode,
    series,
}: {
    mode: "active" | "closed";
    series: SprintBurndownSeries;
}) {
    const { t } = useTranslation("board");

    if (series.emptyReason) {
        return (
            <p className="text-ui text-muted-foreground">
                {t(`sprints.burndownEmpty.${series.emptyReason}`)}
            </p>
        );
    }

    if (series.days.length === 0) {
        return (
            <p className="text-ui text-muted-foreground">
                {t("sprints.burndownEmpty.missing_dates")}
            </p>
        );
    }

    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const maxY = Math.max(
        series.commitmentTotal,
        ...series.days.map((day) => day.ideal),
        ...series.days.flatMap((day) =>
            day.remaining === null ? [] : [day.remaining]
        ),
        1
    );

    const xAt = (index: number) => {
        if (series.days.length === 1) return PAD.left + plotWidth / 2;
        return PAD.left + (index / (series.days.length - 1)) * plotWidth;
    };
    const yAt = (value: number) => PAD.top + plotHeight * (1 - value / maxY);

    const idealPath = series.days
        .map((day, index) => {
            const command = index === 0 ? "M" : "L";
            return `${command}${xAt(index)},${yAt(day.ideal)}`;
        })
        .join(" ");

    const remainingDays = series.days
        .map((day, index) => ({ day, index }))
        .filter((item) => item.day.remaining !== null);
    const remainingPath = remainingDays
        .map(({ day, index }, pathIndex) => {
            const command = pathIndex === 0 ? "M" : "L";
            return `${command}${xAt(index)},${yAt(day.remaining!)}`;
        })
        .join(" ");

    const firstDate = series.days[0]?.date;
    const lastDate = series.days.at(-1)?.date;
    const metricLabel =
        series.metric === "points"
            ? t("sprints.burndownMetricPoints")
            : t("sprints.burndownMetricCount");

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-ui font-medium">
                    {t("sprints.burndownTitle")}
                </h3>
                <p className="text-meta text-muted-foreground">{metricLabel}</p>
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
            <svg
                aria-label={t("sprints.burndownTitle")}
                className="h-auto w-full max-w-full text-foreground"
                role="img"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            >
                <line
                    className="stroke-border"
                    strokeWidth={1}
                    x1={PAD.left}
                    x2={PAD.left}
                    y1={PAD.top}
                    y2={HEIGHT - PAD.bottom}
                />
                <line
                    className="stroke-border"
                    strokeWidth={1}
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={HEIGHT - PAD.bottom}
                    y2={HEIGHT - PAD.bottom}
                />
                <text
                    className="fill-muted-foreground text-[10px]"
                    textAnchor="end"
                    x={PAD.left - 6}
                    y={PAD.top + 4}
                >
                    {maxY}
                </text>
                <text
                    className="fill-muted-foreground text-[10px]"
                    textAnchor="end"
                    x={PAD.left - 6}
                    y={HEIGHT - PAD.bottom}
                >
                    0
                </text>
                {firstDate ? (
                    <text
                        className="fill-muted-foreground text-[10px]"
                        textAnchor="start"
                        x={PAD.left}
                        y={HEIGHT - 8}
                    >
                        {firstDate}
                    </text>
                ) : null}
                {lastDate ? (
                    <text
                        className="fill-muted-foreground text-[10px]"
                        textAnchor="end"
                        x={WIDTH - PAD.right}
                        y={HEIGHT - 8}
                    >
                        {lastDate}
                    </text>
                ) : null}
                <path
                    className="stroke-muted-foreground"
                    d={idealPath}
                    fill="none"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                />
                {remainingPath ? (
                    <path
                        className="stroke-primary"
                        d={remainingPath}
                        fill="none"
                        strokeWidth={2}
                    />
                ) : null}
            </svg>
            <div className="flex flex-wrap gap-4 text-meta text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="inline-block h-px w-4 border-t border-dashed border-muted-foreground"
                    />
                    {t("sprints.burndownIdeal")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="inline-block h-0.5 w-4 bg-primary"
                    />
                    {t("sprints.burndownActual")}
                </span>
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
