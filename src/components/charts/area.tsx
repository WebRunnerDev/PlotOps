"use client";

import { curveMonotoneX } from "@visx/curve";
import { LinePath } from "@visx/shape";
import { area as d3Area } from "d3-shape";
import { useCallback, useId, useMemo, useRef } from "react";

import {
    chartCssVars as chartCssVariables,
    useChartStable,
    useYScale,
} from "./chart-context";
import { AreaGradientDefs } from "./area-gradient-defs";
import { type FadeEdges, resolveFadeSides } from "./fade-edges";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";

// CurveFactory type - simplified version compatible with visx
// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

export interface AreaProperties {
    /**
     * Key in data for the lower edge of the fill. Omit to fill down to the
     * x axis. Set it to the previous series' `dataKey` to stack areas: each
     * band then fills only between its own top and the band below it.
     */
    baseDataKey?: string;
    /** Curve function. Default: curveMonotoneX */
    curve?: CurveFactory;
    /** Key in data to use for y values (the top edge of the fill). */
    dataKey: string;
    /** Opacity series fade to while the chart is hovered. Default: 0.6 */
    dimOpacity?: number;
    /**
     * Fade the area fill (and stroke) toward transparent at the chart edges.
     * Default: false
     */
    fadeEdges?: FadeEdges;
    /** Fill color for the area gradient start. Default: var(--chart-line-primary) */
    fill?: string;
    /** Fill opacity at the top of the area. Default: 0.4 */
    fillOpacity?: number;
    /** Vertical extent of the fill gradient (0–1). Default: 1 */
    gradientSpan?: number;
    /** Gradient opacity at bottom (0 = fully transparent). Default: 0 */
    gradientToOpacity?: number;
    /** Whether to show highlight segment on hover. Default: true */
    showHighlight?: boolean;
    /** Whether to show the stroke line along the top edge. Default: true */
    showLine?: boolean;
    /** Stroke color for the line. Default: same as fill */
    stroke?: string;
    /** Stroke width. Default: 2 */
    strokeWidth?: number;
    /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
    yAxisId?: number | string;
}

/**
 * Bklit area series: gradient fill under a stroked top edge, dimmed while
 * the chart is hovered with a highlight segment under the cursor. Ported
 * without the loading pulse / value labels — PlotOps charts render only in
 * the ready state. `baseDataKey` adds stacking (Cumulative flow).
 */
export function Area({
    baseDataKey,
    curve = curveMonotoneX,
    dataKey,
    dimOpacity = 0.6,
    fadeEdges = false,
    fill = chartCssVariables.linePrimary,
    fillOpacity = 0.4,
    gradientSpan = 1,
    gradientToOpacity = 0,
    showHighlight = true,
    showLine = true,
    stroke,
    strokeWidth = 2,
    yAxisId,
}: AreaProperties) {
    const {
        chartPhase,
        innerHeight,
        innerWidth,
        lines,
        renderData,
        xAccessor,
        xScale,
    } = useChartStable();
    const yScale = useYScale(yAxisId);

    const showSeriesContent =
        chartPhase === "revealing" ||
        chartPhase === "ready" ||
        chartPhase === "exitingReady";

    const seriesIndex = useMemo(() => {
        const index = lines.findIndex((line) => line.dataKey === dataKey);
        return Math.max(index, 0);
    }, [lines, dataKey]);

    const pathReference = useRef<SVGPathElement>(null);
    const reactId = useId();
    const gradientId = `area-gradient-${dataKey}-${reactId}`;
    const strokeGradientId = `area-stroke-gradient-${dataKey}-${reactId}`;
    const edgeMaskId = `area-edge-mask-${dataKey}-${reactId}`;
    const edgeGradientId = `${edgeMaskId}-gradient`;

    const isPatternFill = fill.startsWith("url(");
    const areaFill = isPatternFill ? fill : `url(#${gradientId})`;
    const resolvedStroke =
        stroke || (isPatternFill ? chartCssVariables.linePrimary : fill);

    const getX = useCallback(
        (datum: Record<string, unknown>) => xScale(xAccessor(datum)) ?? 0,
        [xAccessor, xScale]
    );
    const getY = useCallback(
        (datum: Record<string, unknown>) => {
            const value = datum[dataKey];
            return typeof value === "number" ? (yScale(value) ?? 0) : 0;
        },
        [dataKey, yScale]
    );
    const getBaseY = useCallback(
        (datum: Record<string, unknown>) => {
            const value = baseDataKey ? datum[baseDataKey] : 0;
            return yScale(typeof value === "number" ? value : 0) ?? 0;
        },
        [baseDataKey, yScale]
    );

    const areaPathD = useMemo(() => {
        if (!showSeriesContent) return "";
        return (
            d3Area<Record<string, unknown>>()
                .curve(curve)
                .x(getX)
                .y0(getBaseY)
                .y1(getY)(renderData) ?? ""
        );
    }, [curve, getBaseY, getX, getY, renderData, showSeriesContent]);

    const fadeSides = resolveFadeSides(fadeEdges);
    const useEdgeMask = fadeSides.any && !isPatternFill;
    const strokePaint =
        fadeSides.any && !useEdgeMask
            ? `url(#${strokeGradientId})`
            : resolvedStroke;
    const showSeriesStroke = showSeriesContent && showLine;
    const highlightEnabled = showHighlight && showSeriesStroke;

    const layers = (
        <>
            {areaPathD ? <path d={areaPathD} fill={areaFill} /> : null}
            {showLine ? (
                <LinePath
                    curve={curve}
                    data={renderData}
                    innerRef={pathReference}
                    stroke={showSeriesStroke ? strokePaint : "transparent"}
                    strokeLinecap="round"
                    strokeWidth={strokeWidth}
                    x={getX}
                    y={getY}
                />
            ) : null}
        </>
    );

    return (
        <>
            <AreaGradientDefs
                edgeGradientId={edgeGradientId}
                edgeMaskId={edgeMaskId}
                fadeEdges={fadeEdges}
                fill={fill}
                fillOpacity={fillOpacity}
                gradientId={gradientId}
                gradientSpan={gradientSpan}
                gradientToOpacity={gradientToOpacity}
                innerHeight={innerHeight}
                innerWidth={innerWidth}
                isPatternFill={isPatternFill}
                resolvedStroke={resolvedStroke}
                strokeGradientId={strokeGradientId}
            />

            <SeriesHoverDim
                dimOpacity={dimOpacity}
                enabled={showHighlight}
                seriesIndex={seriesIndex}
            >
                {useEdgeMask ? (
                    <g mask={`url(#${edgeMaskId})`}>{layers}</g>
                ) : (
                    layers
                )}
            </SeriesHoverDim>

            <SeriesHighlightLayer
                enabled={highlightEnabled}
                height={innerHeight}
                pathRef={pathReference}
                stroke={resolvedStroke}
                strokeWidth={strokeWidth}
            />
        </>
    );
}

Area.displayName = "Area";

export default Area;
