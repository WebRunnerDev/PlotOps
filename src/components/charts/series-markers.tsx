"use client";

import { type ReactNode, useCallback, useMemo } from "react";

import { clipRevealTransition } from "./animation";
import {
    defaultScatterColors,
    useChartHover,
    useChartStable,
    useYScale,
} from "./chart-context";
import { useChartLegendHover } from "./chart-legend-hover";
import {
    getSeriesMarkerVisualExtent,
    SeriesPointMarker,
    type SeriesPointMarkerStyle,
    StaticSeriesPointMarker,
} from "./series-point-marker";

export interface SeriesMarkersProperties extends SeriesPointMarkerStyle {
    /** Whether to animate markers with clip reveal. Default: true */
    animate?: boolean;
    dataKey: string;
    /** Marker fill color. Defaults to series stroke or chart palette color. */
    fill?: string;
}

interface MarkerStyle {
    fill: string;
    outlineColor?: string;
    outlineWidth: number;
    radius: number;
    ringGap: number;
    stroke: string;
    strokeWidth: number;
}

interface PointAt {
    cx: number;
    cy: number;
    index: number;
    revealDelay: number;
}

export function SeriesMarkers({
    animate = true,
    dataKey,
    enterBlur = 2,
    fadeOnHover = true,
    fill,
    inactiveBlur = 2,
    inactiveOpacity = 0.5,
    outlineColor,
    outlineWidth = 0,
    radius = 5,
    ringGap = 2,
    showActiveHighlight = true,
    stroke,
    strokeWidth = 2,
}: SeriesMarkersProperties) {
    // Stable slice only. Hover-driven dim + active-highlight live in the inner
    // <SeriesMarkersDimWrapper> / <SeriesMarkersActiveHighlight> components, so
    // mouse motion does not re-render the full point grid.
    const {
        animationDuration,
        data,
        enterTransition,
        innerWidth,
        isLoaded,
        lines,
        revealEpoch,
        xAccessor,
        xScale,
    } = useChartStable();

    const seriesIndex = useMemo(() => {
        const index = lines.findIndex((line) => line.dataKey === dataKey);
        return Math.max(index, 0);
    }, [lines, dataKey]);

    const seriesConfig = lines[seriesIndex];
    const yScale = useYScale(seriesConfig?.yAxisId);
    const seriesColor =
        defaultScatterColors[seriesIndex % defaultScatterColors.length] ??
        defaultScatterColors[0];

    const resolvedFill = fill ?? seriesConfig?.stroke ?? seriesColor;
    const resolvedStroke = stroke ?? resolvedFill;

    const visualExtent = useMemo(
        () =>
            getSeriesMarkerVisualExtent({
                outlineWidth,
                radius,
                ringGap,
                showActiveHighlight,
                strokeWidth,
            }),
        [radius, strokeWidth, ringGap, outlineWidth, showActiveHighlight]
    );

    const revealDurationSec =
        clipRevealTransition(enterTransition).duration ??
        animationDuration / 1000;
    const enterDuration = 0.5;
    const isRevealing = animate && !isLoaded;

    const getY = useCallback(
        (d: Record<string, unknown>) => {
            const value = d[dataKey];
            return typeof value === "number" ? (yScale(value) ?? 0) : null;
        },
        [dataKey, yScale]
    );

    const points = useMemo<PointAt[]>(
        () =>
            data.flatMap((d, index) => {
                const cy = getY(d);
                if (cy === null) {
                    return [];
                }
                const cx = xScale(xAccessor(d)) ?? 0;
                const leadingEdge = Math.max(0, cx - visualExtent);
                const revealDelay =
                    innerWidth > 0 && isRevealing
                        ? (leadingEdge / innerWidth) * revealDurationSec
                        : 0;

                return [{ cx, cy, index, revealDelay }];
            }),
        [
            data,
            getY,
            xScale,
            xAccessor,
            innerWidth,
            isRevealing,
            revealDurationSec,
            visualExtent,
        ]
    );

    // Memo so the inner <SeriesMarkersActiveHighlight> sees a stable prop and
    // can be cheaply re-rendered on hover without re-creating the spread.
    const markerStyle = useMemo<MarkerStyle>(
        () => ({
            fill: resolvedFill,
            outlineColor,
            outlineWidth,
            radius,
            ringGap,
            stroke: resolvedStroke,
            strokeWidth,
        }),
        [
            resolvedFill,
            resolvedStroke,
            strokeWidth,
            ringGap,
            outlineWidth,
            outlineColor,
            radius,
        ]
    );

    if (isRevealing) {
        return (
            <g>
                {points.map((point) => (
                    <SeriesPointMarker
                        cx={point.cx}
                        cy={point.cy}
                        dataKey={dataKey}
                        enterBlur={enterBlur}
                        enterDuration={enterDuration}
                        index={point.index}
                        key={`${dataKey}-${point.index}`}
                        revealDelay={point.revealDelay}
                        revealEpoch={revealEpoch ?? 0}
                        {...markerStyle}
                    />
                ))}
            </g>
        );
    }

    // Stable base layer — its children come from the parent and stay
    // referentially identical when the dim wrapper re-renders for hover.
    const baseMarkers = points.map((point) => (
        <StaticSeriesPointMarker
            cx={point.cx}
            cy={point.cy}
            key={`${dataKey}-${point.index}`}
            {...markerStyle}
        />
    ));
    const activeScale = showActiveHighlight ? 1.35 : 1;

    return (
        <g>
            <SeriesMarkersDimWrapper
                enabled={fadeOnHover}
                inactiveBlur={inactiveBlur}
                inactiveOpacity={inactiveOpacity}
                seriesIndex={seriesIndex}
            >
                {baseMarkers}
            </SeriesMarkersDimWrapper>
            <SeriesMarkersActiveHighlight
                activeScale={activeScale}
                enabled={fadeOnHover}
                markerStyle={markerStyle}
                points={points}
            />
        </g>
    );
}

SeriesMarkers.displayName = "SeriesMarkers";

interface SeriesMarkersActiveHighlightProperties {
    activeScale: number;
    enabled: boolean;
    markerStyle: MarkerStyle;
    points: PointAt[];
}

interface SeriesMarkersDimWrapperProperties {
    children: ReactNode;
    enabled: boolean;
    inactiveBlur: number;
    inactiveOpacity: number;
    seriesIndex: number;
}

/**
 * Renders the scaled "active" marker on top of the base grid. Subscribes to
 * hover internally; the parent doesn't re-render on cursor motion.
 */
function SeriesMarkersActiveHighlight({
    activeScale,
    enabled,
    markerStyle,
    points,
}: SeriesMarkersActiveHighlightProperties) {
    const { tooltipData } = useChartHover();
    if (!enabled || tooltipData === null) {
        return null;
    }
    const activePoint = points.find(
        (point) => point.index === tooltipData.index
    );
    if (!activePoint) {
        return null;
    }
    return (
        <StaticSeriesPointMarker
            cx={activePoint.cx}
            cy={activePoint.cy}
            scale={activeScale}
            {...markerStyle}
        />
    );
}

/**
 * Wraps the stable point grid with hover-driven opacity + blur. Subscribes to
 * hover internally so the grid (passed as `children`) keeps a stable reference
 * and React skips reconciling it when this wrapper re-renders.
 */
function SeriesMarkersDimWrapper({
    children,
    enabled,
    inactiveBlur,
    inactiveOpacity,
    seriesIndex,
}: SeriesMarkersDimWrapperProperties) {
    const { tooltipData } = useChartHover();
    const { hoveredIndex: legendHoveredIndex } = useChartLegendHover();
    const isLegendDimmed =
        legendHoveredIndex !== null && legendHoveredIndex !== seriesIndex;
    const dimBase = enabled && (tooltipData !== null || isLegendDimmed);
    return (
        <g
            opacity={dimBase ? inactiveOpacity : 1}
            style={{
                filter:
                    dimBase && inactiveBlur > 0
                        ? `blur(${inactiveBlur}px)`
                        : "none",
                transition:
                    "opacity 0.15s ease-in-out, filter 0.15s ease-in-out",
            }}
        >
            {children}
        </g>
    );
}

export default SeriesMarkers;
