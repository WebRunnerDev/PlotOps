import { curveLinear } from "@visx/curve";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CumulativeFlow } from "@/features/flow-reports/model/build-cumulative-flow";

import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { ChartLegendHoverProvider } from "@/components/charts/chart-legend-hover";
import { ChartYValueAxis } from "@/components/charts/chart-y-value-axis";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import {
    flowColumnColors,
    FlowDataTable,
    flowTableHeadClassName,
    formatShortDate,
    LegendSwatch,
} from "@/features/flow-reports/ui/flow-chart-parts";
import { cn } from "@/shared/lib/utils";

const TOP_KEY = "top";
const COUNT_KEY = "count";

/**
 * Stacked area of Tasks per column by day (Bklit AreaChart). The last
 * column sits at the bottom so Done grows upward from the baseline; the
 * legend lists columns in Board order, matching the stack from top to
 * bottom. Legend entries hide or show their band: hiding Done, which
 * usually dwarfs the rest, shows where work in progress piles up.
 */
export function CumulativeFlowChart({ flow }: { flow: CumulativeFlow }) {
    const { t } = useTranslation("board");
    const colors = useMemo(() => flowColumnColors(flow.columns), [flow]);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const [legendHover, setLegendHover] = useState<null | number>(null);

    // Visible columns in Board order: index 0 is the top band.
    const visible = useMemo(
        () =>
            flow.columns
                .map((column, index) => ({
                    color: colors[index]!,
                    column,
                    index,
                }))
                .filter(({ column }) => !hidden.has(column.id)),
        [colors, flow.columns, hidden]
    );

    const data = useMemo(
        () =>
            flow.days.map((day) => {
                const point: Record<string, unknown> = {
                    date: parseLocalDate(day.date),
                };
                // Accumulate bottom → top so each band's top is the sum of
                // itself and every visible band below it.
                let running = 0;
                for (const { index } of visible.toReversed()) {
                    const count = day.counts[index] ?? 0;
                    running += count;
                    point[`${TOP_KEY}${index}`] = running;
                    point[`${COUNT_KEY}${index}`] = count;
                }
                return point;
            }),
        [flow.days, visible]
    );

    const toggle = useCallback(
        (columnId: string) => {
            setHidden((previous) => {
                const next = new Set(previous);
                if (next.has(columnId)) {
                    next.delete(columnId);
                } else if (visible.length > 1) {
                    next.add(columnId);
                }
                return next;
            });
        },
        [visible.length]
    );

    const hoveredSeries =
        legendHover === null
            ? null
            : visible.findIndex(({ index }) => index === legendHover);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <ul
                aria-label={t("flow.legendLabel")}
                className="flex flex-wrap gap-1.5"
            >
                {flow.columns.map((column, index) => {
                    const shown = !hidden.has(column.id);
                    const locked = shown && visible.length === 1;
                    return (
                        <li key={column.id}>
                            <button
                                aria-pressed={shown}
                                className={cn(
                                    "inline-flex h-7 items-center gap-1.5 border px-2 text-sm transition-[color,border-color,background-color] duration-200 ease-(--ease-out-expo) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
                                    shown
                                        ? "border-border bg-card/60 text-foreground hover:border-primary/50"
                                        : "border-dashed border-border text-muted-foreground hover:text-foreground"
                                )}
                                disabled={locked}
                                onBlur={() => setLegendHover(null)}
                                onClick={() => toggle(column.id)}
                                onFocus={() =>
                                    setLegendHover(shown ? index : null)
                                }
                                onPointerEnter={() =>
                                    setLegendHover(shown ? index : null)
                                }
                                onPointerLeave={() => setLegendHover(null)}
                                title={t(
                                    shown
                                        ? "flow.legendHide"
                                        : "flow.legendShow",
                                    { column: column.name }
                                )}
                                type="button"
                            >
                                <LegendSwatch
                                    color={
                                        shown ? colors[index]! : "transparent"
                                    }
                                    outlined={!shown}
                                />
                                <span className={cn(!shown && "line-through")}>
                                    {column.name}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <ChartLegendHoverProvider
                hoveredIndex={hoveredSeries === -1 ? null : hoveredSeries}
                onHoverChange={(series) =>
                    setLegendHover(
                        series === null
                            ? null
                            : (visible[series]?.index ?? null)
                    )
                }
            >
                <div aria-label={t("flow.cfdChartLabel")} role="img">
                    <AreaChart
                        aspectRatio="auto"
                        className="h-72 w-full"
                        data={data}
                        margin={{ bottom: 34, left: 40, right: 12, top: 12 }}
                        status="ready"
                    >
                        <Grid horizontal numTicksRows={4} />
                        {visible.map(({ color, index }, position) => {
                            const below = visible[position + 1];
                            return (
                                <Area
                                    baseDataKey={
                                        below
                                            ? `${TOP_KEY}${below.index}`
                                            : undefined
                                    }
                                    curve={curveLinear}
                                    dataKey={`${TOP_KEY}${index}`}
                                    dimOpacity={0.75}
                                    fill={color}
                                    fillOpacity={0.9}
                                    gradientToOpacity={0.45}
                                    key={flow.columns[index]!.id}
                                    stroke={color}
                                    strokeWidth={1.5}
                                />
                            );
                        })}
                        <ChartYValueAxis numTicks={4} />
                        <XAxis numTicks={Math.min(6, data.length)} />
                        <ChartTooltip
                            backgroundColor="var(--popover)"
                            rows={(point) => [
                                ...visible.map(({ color, column, index }) => ({
                                    color,
                                    label: column.name,
                                    value: Number(
                                        point[`${COUNT_KEY}${index}`] ?? 0
                                    ),
                                })),
                                {
                                    color: "transparent",
                                    label: t("flow.total"),
                                    value: visible.reduce(
                                        (sum, { index }) =>
                                            sum +
                                            Number(
                                                point[`${COUNT_KEY}${index}`] ??
                                                    0
                                            ),
                                        0
                                    ),
                                },
                            ]}
                            showDatePill={false}
                            showDots
                        />
                    </AreaChart>
                </div>
            </ChartLegendHoverProvider>

            <CumulativeFlowTable colors={colors} flow={flow} />
        </div>
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
        <FlowDataTable>
            <thead className={flowTableHeadClassName}>
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
                    <tr
                        className="transition-colors hover:bg-primary/5"
                        key={day.date}
                    >
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
                                className={cn(
                                    "px-3 py-1.5 text-right",
                                    count === 0 && "text-muted-foreground/60"
                                )}
                                key={flow.columns[index]!.id}
                            >
                                {count}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </FlowDataTable>
    );
}

function parseLocalDate(iso: string): Date {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year!, (month ?? 1) - 1, day ?? 1);
}
