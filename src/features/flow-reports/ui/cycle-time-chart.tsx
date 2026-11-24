import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
    CycleTime,
    CycleTimePoint,
} from "@/features/flow-reports/model/build-cycle-time";

import {
    ChartTooltipBox,
    DAY_MS,
    formatCycleDuration,
    formatShortDate,
} from "@/features/flow-reports/ui/flow-chart-parts";

const HEIGHT = 260;
const MARGIN = { bottom: 28, left: 36, right: 12, top: 12 };

/**
 * Cycle time per Task by completion date, with the median and the 85th
 * percentile as reference lines. Each point opens its Task.
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
    return (
        <div className="relative w-full" style={{ height: HEIGHT }}>
            <ParentSize debounceTime={10}>
                {({ width }) =>
                    width > 0 ? (
                        <CycleTimePlot
                            cycle={cycle}
                            now={now}
                            onOpenTask={onOpenTask}
                            since={since}
                            width={width}
                        />
                    ) : null
                }
            </ParentSize>
        </div>
    );
}

function CycleTimePlot({
    cycle,
    now,
    onOpenTask,
    since,
    width,
}: {
    cycle: CycleTime;
    now: Date;
    onOpenTask: (taskId: string) => void;
    since: Date;
    width: number;
}) {
    const { i18n, t } = useTranslation("board");
    const locale = i18n.resolvedLanguage;
    const [active, setActive] = useState<CycleTimePoint | null>(null);
    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const maxDays = Math.max(
        1,
        ...cycle.points.map((point) => point.durationMs / DAY_MS),
        (cycle.p85Ms ?? 0) / DAY_MS
    );
    const x = scaleTime<number>({
        domain: [since, now],
        range: [0, innerWidth],
    });
    const y = scaleLinear<number>({
        domain: [0, maxDays * 1.1],
        nice: true,
        range: [innerHeight, 0],
    });
    const yTicks = y.ticks(4);
    const xTicks = x.ticks(innerWidth < 360 ? 3 : 6);
    const format = (ms: number) => formatCycleDuration(ms, locale, t);

    // Close lines: p85 labelled above its line, the median below its own.
    const close =
        cycle.medianMs !== null &&
        cycle.p85Ms !== null &&
        Math.abs(y(cycle.medianMs / DAY_MS) - y(cycle.p85Ms / DAY_MS)) < 16;
    const references = [
        cycle.medianMs === null
            ? null
            : {
                  below: close,
                  dash: undefined,
                  key: "median",
                  label: t("flow.medianShort", {
                      value: format(cycle.medianMs),
                  }),
                  ms: cycle.medianMs,
              },
        cycle.p85Ms === null
            ? null
            : {
                  below: false,
                  dash: "4 3",
                  key: "p85",
                  label: t("flow.p85Short", { value: format(cycle.p85Ms) }),
                  ms: cycle.p85Ms,
              },
    ].filter((item) => item !== null);

    const onKey = (event: KeyboardEvent, point: CycleTimePoint) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpenTask(point.task.id);
        }
    };

    return (
        <>
            <svg
                aria-label={t("flow.cycleChartLabel")}
                height={HEIGHT}
                role="group"
                width={width}
            >
                <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {yTicks.map((tick) => (
                        <g key={tick}>
                            <line
                                stroke="var(--chart-grid)"
                                strokeDasharray={tick === 0 ? undefined : "2 3"}
                                x1={0}
                                x2={innerWidth}
                                y1={y(tick)}
                                y2={y(tick)}
                            />
                            <text
                                className="fill-muted-foreground text-[11px] tabular-nums"
                                dominantBaseline="middle"
                                textAnchor="end"
                                x={-8}
                                y={y(tick)}
                            >
                                {tick}
                            </text>
                        </g>
                    ))}
                    <text
                        className="fill-muted-foreground text-[11px]"
                        x={-MARGIN.left + 2}
                        y={-2}
                    >
                        {t("flow.axisDays")}
                    </text>
                    {xTicks.map((tick) => (
                        <text
                            className="fill-muted-foreground text-[11px]"
                            key={tick.getTime()}
                            textAnchor="middle"
                            x={x(tick)}
                            y={innerHeight + 18}
                        >
                            {formatShortDate(tick, locale)}
                        </text>
                    ))}
                    {references.map((reference) => (
                        <g key={reference.key}>
                            <line
                                stroke="var(--chart-line-secondary)"
                                strokeDasharray={reference.dash}
                                strokeWidth={1.5}
                                x1={0}
                                x2={innerWidth}
                                y1={y(reference.ms / DAY_MS)}
                                y2={y(reference.ms / DAY_MS)}
                            />
                            <text
                                className="fill-muted-foreground text-[11px]"
                                paintOrder="stroke"
                                stroke="var(--card)"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                textAnchor="end"
                                x={innerWidth - 4}
                                y={
                                    y(reference.ms / DAY_MS) +
                                    (reference.below ? 13 : -5)
                                }
                            >
                                {reference.label}
                            </text>
                        </g>
                    ))}
                    {cycle.points.map((point) => {
                        const cx = x(new Date(point.completedAt));
                        const cy = y(point.durationMs / DAY_MS);
                        const isActive = active?.task.id === point.task.id;
                        return (
                            <g
                                aria-label={t("flow.pointLabel", {
                                    duration: format(point.durationMs),
                                    key: point.task.key,
                                    title: point.task.title,
                                })}
                                className="cursor-pointer outline-none [&:focus-visible>circle:last-child]:stroke-ring"
                                key={point.task.id}
                                onBlur={() => setActive(null)}
                                onClick={() => onOpenTask(point.task.id)}
                                onFocus={() => setActive(point)}
                                onKeyDown={(event) => onKey(event, point)}
                                onPointerEnter={() => setActive(point)}
                                onPointerLeave={() => setActive(null)}
                                role="button"
                                tabIndex={0}
                            >
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    fill="transparent"
                                    r={11}
                                />
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    fill="var(--chart-1)"
                                    r={isActive ? 6 : 4.5}
                                    stroke="var(--card)"
                                    strokeWidth={2}
                                />
                            </g>
                        );
                    })}
                </g>
            </svg>
            {active ? (
                <ChartTooltipBox
                    left={MARGIN.left + x(new Date(active.completedAt))}
                    top={Math.max(
                        0,
                        MARGIN.top + y(active.durationMs / DAY_MS) - 24
                    )}
                    width={width}
                >
                    <p className="font-medium">
                        <span className="text-muted-foreground">
                            {active.task.key}
                        </span>{" "}
                        {active.task.title}
                    </p>
                    <p className="tabular-nums">
                        {t("flow.cycleTimeValue", {
                            value: format(active.durationMs),
                        })}
                    </p>
                    <p className="text-muted-foreground">
                        {t("flow.completedOn", {
                            date: formatShortDate(active.completedAt, locale),
                        })}
                    </p>
                </ChartTooltipBox>
            ) : null}
        </>
    );
}
