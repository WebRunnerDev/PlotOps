"use client";

import type { scaleLinear, scaleTime } from "@visx/scale";

import {
    type CSSProperties,
    type PointerEvent,
    useCallback,
    useMemo,
} from "react";

import type { LineConfig, Margin, TooltipData } from "./chart-context";

import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { normalizeYAxisId } from "./y-axis-scales";

type XScale = ReturnType<typeof scaleTime<number>>;
type YScale = ReturnType<typeof scaleLinear<number>>;

/** Hover and click reach a point within this many px of the pointer. */
export const SCATTER_HIT_RADIUS_PX = 40;

interface ScatterPoint {
    dataKey: string;
    index: number;
    x: number;
    y: number;
}

interface UseScatterChartInteractionParameters {
    canInteract: boolean;
    data: Record<string, unknown>[];
    lines: LineConfig[];
    margin: Margin;
    onPointClick?: (point: Record<string, unknown>, index: number) => void;
    xAccessor: (datum: Record<string, unknown>) => Date;
    xScale: XScale;
    yScale: YScale;
    yScales: Record<string, YScale>;
}

/**
 * Bklit scatter hit testing: the nearest point in 2D (not the nearest x, as
 * line charts do), so points that share a date stay reachable. PlotOps adds
 * a hit radius, click-to-open and keyboard stepping through points in x
 * order; drag selection from the original is left out.
 */
export function useScatterChartInteraction({
    canInteract,
    data,
    lines,
    margin,
    onPointClick,
    xAccessor,
    xScale,
    yScale,
    yScales,
}: UseScatterChartInteractionParameters) {
    const { clearTooltip, scheduleTooltip, setTooltipData, tooltipData } =
        useScheduledTooltip<TooltipData>();

    const points = useMemo<ScatterPoint[]>(() => {
        const result: ScatterPoint[] = [];
        for (const line of lines) {
            const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
            for (const [index, datum] of data.entries()) {
                const value = datum[line.dataKey];
                if (typeof value !== "number") continue;
                result.push({
                    dataKey: line.dataKey,
                    index,
                    x: xScale(xAccessor(datum)) ?? 0,
                    y: axisScale(value) ?? 0,
                });
            }
        }
        return result.toSorted((a, b) => a.x - b.x || a.y - b.y);
    }, [data, lines, xAccessor, xScale, yScale, yScales]);

    const toTooltip = useCallback(
        (point: ScatterPoint): null | TooltipData => {
            const datum = data[point.index];
            if (!datum) return null;
            return {
                index: point.index,
                point: datum,
                x: point.x,
                xPositions: { [point.dataKey]: point.x },
                yPositions: { [point.dataKey]: point.y },
            };
        },
        [data]
    );

    const nearestPoint = useCallback(
        (x: number, y: number): null | ScatterPoint => {
            let nearest: null | ScatterPoint = null;
            let nearestDistance = SCATTER_HIT_RADIUS_PX ** 2;
            for (const point of points) {
                const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
                if (distance <= nearestDistance) {
                    nearest = point;
                    nearestDistance = distance;
                }
            }
            return nearest;
        },
        [points]
    );

    const pointFromEvent = useCallback(
        (event: PointerEvent<SVGGElement>) => {
            const box =
                event.currentTarget.ownerSVGElement?.getBoundingClientRect();
            if (!box) return null;
            return nearestPoint(
                event.clientX - box.left - margin.left,
                event.clientY - box.top - margin.top
            );
        },
        [margin.left, margin.top, nearestPoint]
    );

    const show = useCallback(
        (point: null | ScatterPoint) => {
            const tooltip = point ? toTooltip(point) : null;
            if (tooltip) {
                scheduleTooltip(tooltip, `${point!.dataKey}:${point!.index}`);
            } else {
                clearTooltip();
            }
        },
        [clearTooltip, scheduleTooltip, toTooltip]
    );

    const onPointerMove = useCallback(
        (event: PointerEvent<SVGGElement>) => show(pointFromEvent(event)),
        [pointFromEvent, show]
    );

    const onClick = useCallback(
        (event: PointerEvent<SVGGElement>) => {
            const point = pointFromEvent(event);
            const datum = point ? data[point.index] : undefined;
            if (point && datum) onPointClick?.(datum, point.index);
        },
        [data, onPointClick, pointFromEvent]
    );

    /** Arrow keys step through points left to right; Enter opens one. */
    const onKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (points.length === 0) return;
            const current = tooltipData
                ? points.findIndex(
                      (point) =>
                          point.index === tooltipData.index &&
                          tooltipData.yPositions[point.dataKey] !== undefined
                  )
                : -1;
            switch (event.key) {
                case " ":
                case "Enter": {
                    const datum =
                        current === -1
                            ? undefined
                            : data[points[current]!.index];
                    if (!datum) return;
                    event.preventDefault();
                    onPointClick?.(datum, points[current]!.index);
                    return;
                }
                case "ArrowLeft":
                case "ArrowRight": {
                    event.preventDefault();
                    const step = event.key === "ArrowRight" ? 1 : -1;
                    const next =
                        current === -1
                            ? step === 1
                                ? 0
                                : points.length - 1
                            : Math.min(
                                  points.length - 1,
                                  Math.max(0, current + step)
                              );
                    setTooltipData(toTooltip(points[next]!));
                    return;
                }
                case "Escape": {
                    clearTooltip();
                    return;
                }
                default: {
                    return;
                }
            }
        },
        [
            clearTooltip,
            data,
            onPointClick,
            points,
            setTooltipData,
            toTooltip,
            tooltipData,
        ]
    );

    const interactionHandlers = canInteract
        ? {
              onClick: onPointClick ? onClick : undefined,
              onPointerLeave: clearTooltip,
              onPointerMove,
          }
        : {};

    const interactionStyle: CSSProperties = {
        cursor:
            canInteract && onPointClick && tooltipData ? "pointer" : "default",
        touchAction: "pan-y",
    };

    return {
        clearTooltip,
        interactionHandlers,
        interactionStyle,
        onKeyDown,
        setTooltipData,
        tooltipData,
    };
}
