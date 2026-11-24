import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { area, type SeriesPoint, stack } from "d3-shape";
import { type PointerEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CumulativeFlow } from "@/features/flow-reports/model/build-cumulative-flow";

import {
    ChartTooltipBox,
    flowColumnColors,
    formatShortDate,
    LegendSwatch,
} from "@/features/flow-reports/ui/flow-chart-parts";

const HEIGHT = 260;
const MARGIN = { bottom: 28, left: 36, right: 12, top: 12 };

/**
 * Stacked area of Tasks per column by day. The last column sits at the
 * bottom so Done grows upward from the baseline; the legend lists columns
 * in Board order, matching the stack from top to bottom.
 */
export function CumulativeFlowChart({ flow }: { flow: CumulativeFlow }) {
    const { t } = useTranslation("board");
    const colors = useMemo(() => flowColumnColors(flow.columns), [flow]);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <ul
                aria-label={t("flow.legendLabel")}
                className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
            >
                {flow.columns.map((column, index) => (
                    <li className="flex items-center gap-1.5" key={column.id}>
                        <LegendSwatch color={colors[index]!} />
                        {column.name}
                    </li>
                ))}
            </ul>
            <div className="relative w-full" style={{ height: HEIGHT }}>
                <ParentSize debounceTime={10}>
                    {({ width }) =>
                        width > 0 ? (
                            <CumulativeFlowPlot
                                colors={colors}
                                flow={flow}
                                width={width}
                            />
                        ) : null
                    }
                </ParentSize>
            </div>
            <CumulativeFlowTable colors={colors} flow={flow} />
        </div>
    );
}

function CumulativeFlowPlot({
    colors,
    flow,
    width,
}: {
    colors: string[];
    flow: CumulativeFlow;
    width: number;
}) {
    const { i18n, t } = useTranslation("board");
    const [hover, setHover] = useState<null | number>(null);
    const locale = i18n.resolvedLanguage;
    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const { days } = flow;

    const layers = useMemo(() => {
        // Bottom → top: last column first.
        const keys = flow.columns.map((_, index) => index).toReversed();
        return stack<number[], number>()
            .keys(keys)
            .value((counts, key) => counts[key] ?? 0)(
            days.map((day) => day.counts)
        );
    }, [days, flow.columns]);

    const maxTotal = Math.max(
        1,
        ...days.map((day) => day.counts.reduce((sum, count) => sum + count, 0))
    );
    const x = scaleLinear<number>({
        domain: [0, Math.max(1, days.length - 1)],
        range: [0, innerWidth],
    });
    const y = scaleLinear<number>({
        domain: [0, maxTotal],
        nice: true,
        range: [innerHeight, 0],
    });
    const yTicks = y.ticks(4).filter((tick) => Number.isInteger(tick));
    const xTickCount = Math.min(days.length, innerWidth < 360 ? 3 : 6);
    const xTicks =
        days.length <= 1
            ? [0]
            : Array.from({ length: xTickCount }, (_, index) =>
                  Math.round((index * (days.length - 1)) / (xTickCount - 1))
              );

    const shape = area<SeriesPoint<number[]>>()
        .x((_, index) => x(index))
        .y0((point) => y(point[0]))
        .y1((point) => y(point[1]));

    const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const index = Math.round(x.invert(event.clientX - box.left));
        setHover(Math.min(days.length - 1, Math.max(0, index)));
    };

    const hovered = hover === null ? undefined : days[hover];

    return (
        <>
            <svg
                aria-label={t("flow.cfdChartLabel")}
                height={HEIGHT}
                role="img"
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
                    {layers.map((layer) => (
                        <path
                            d={shape(layer) ?? undefined}
                            fill={colors[layer.key]}
                            key={layer.key}
                            stroke="var(--card)"
                            strokeLinejoin="round"
                            strokeWidth={1}
                        />
                    ))}
                    {xTicks.map((index) => (
                        <text
                            className="fill-muted-foreground text-[11px]"
                            key={index}
                            textAnchor={
                                index === 0
                                    ? "start"
                                    : index === days.length - 1
                                      ? "end"
                                      : "middle"
                            }
                            x={x(index)}
                            y={innerHeight + 18}
                        >
                            {formatShortDate(
                                parseLocalDate(days[index]!.date),
                                locale
                            )}
                        </text>
                    ))}
                    {hovered ? (
                        <line
                            stroke="var(--chart-crosshair)"
                            strokeWidth={1}
                            x1={x(hover!)}
                            x2={x(hover!)}
                            y1={0}
                            y2={innerHeight}
                        />
                    ) : null}
                    <rect
                        fill="transparent"
                        height={innerHeight}
                        onPointerLeave={() => setHover(null)}
                        onPointerMove={onPointerMove}
                        width={innerWidth}
                    />
                </g>
            </svg>
            {hovered ? (
                <ChartTooltipBox
                    left={MARGIN.left + x(hover!)}
                    top={MARGIN.top}
                    width={width}
                >
                    <p className="mb-1 font-medium">
                        {formatShortDate(parseLocalDate(hovered.date), locale)}
                    </p>
                    <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5">
                        {flow.columns.map((column, index) => (
                            <div className="contents" key={column.id}>
                                <LegendSwatch color={colors[index]!} />
                                <dt className="text-muted-foreground">
                                    {column.name}
                                </dt>
                                <dd className="text-right tabular-nums">
                                    {hovered.counts[index] ?? 0}
                                </dd>
                            </div>
                        ))}
                        <div className="contents">
                            <span />
                            <dt className="text-muted-foreground">
                                {t("flow.total")}
                            </dt>
                            <dd className="text-right font-medium tabular-nums">
                                {hovered.counts.reduce(
                                    (sum, count) => sum + count,
                                    0
                                )}
                            </dd>
                        </div>
                    </dl>
                </ChartTooltipBox>
            ) : null}
        </>
    );
}

function CumulativeFlowTable({
    colors,
    flow,
}: {
    colors: string[];
    flow: CumulativeFlow;
}) {
    const { i18n, t } = useTranslation("board");
    return (
        <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t("flow.showTable")}
            </summary>
            <div className="mt-2 max-h-72 overflow-auto border border-border">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 border-b border-border bg-muted text-meta text-muted-foreground">
                        <tr>
                            <th className="px-3 py-1.5 font-normal" scope="col">
                                {t("flow.columnDate")}
                            </th>
                            {flow.columns.map((column, index) => (
                                <th
                                    className="px-3 py-1.5 text-right font-normal"
                                    key={column.id}
                                    scope="col"
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <LegendSwatch color={colors[index]!} />
                                        {column.name}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {flow.days.toReversed().map((day) => (
                            <tr key={day.date}>
                                <th
                                    className="px-3 py-1.5 font-normal whitespace-nowrap"
                                    scope="row"
                                >
                                    {formatShortDate(
                                        parseLocalDate(day.date),
                                        i18n.resolvedLanguage
                                    )}
                                </th>
                                {day.counts.map((count, index) => (
                                    <td
                                        className="px-3 py-1.5 text-right tabular-nums"
                                        key={flow.columns[index]!.id}
                                    >
                                        {count}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function parseLocalDate(iso: string): Date {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year!, (month ?? 1) - 1, day ?? 1);
}
