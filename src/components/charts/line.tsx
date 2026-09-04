"use client";

import { curveNatural } from "@visx/curve";
import { LinePath } from "@visx/shape";

export interface LineProperties {
    /** Whether to animate the line. Default: true */
    animate?: boolean;
    /** Curve function. Default: curveNatural */
    curve?: CurveFactory;
    /** Dash pattern for the tail segment when `dashFromIndex` is set. Default: "6,4" */
    dashArray?: string;
    /**
     * Data index from which the line stroke becomes dashed (inclusive).
     * Useful for projecting incomplete periods, e.g. dashed from yesterday through today.
     */
    dashFromIndex?: number;
    /** Key in data to use for y values */
    dataKey: string;
    /**
     * Fade the line stroke toward transparent at the chart edges.
     * - `true` fades both edges, `false` disables the fade entirely.
     * - `"left"` / `"right"` fades only that side.
     * Default: true
     */
    fadeEdges?: FadeEdges;
    /**
     * Show the loading pulse overlay. Default: follows chart loading phase.
     * Set `false` to disable even during loading.
     */
    loading?: boolean;
    /** Override pulse animation mode (loop / exit / enter). */
    loadingPulseMode?: LineLoadingPulseMode;
    /** Stroke color for the loading pulse overlay. Default: var(--foreground) */
    loadingStroke?: string;
    /** Loading pulse stroke opacity. Default: 0.5 */
    loadingStrokeOpacity?: number;
    /**
     * Loading animation while the chart is in loading status: the default
     * traveling `"pulse"`, or a diagonal `"sweep"` shimmer across the skeleton
     * line. Default: `"pulse"`.
     */
    loadingStyle?: LoadingStyle;
    /** Marker styling (same options as Scatter). */
    markers?: SeriesPointMarkerStyle;
    /** Called when a loop-mode pulse cycle completes. */
    onLoadingPulseCycleComplete?: () => void;
    /** Whether to show highlight segment on hover. Default: true */
    showHighlight?: boolean;
    /** Render scatter-style circle markers at each data point. Default: false */
    showMarkers?: boolean;
    /** Stroke color. Default: var(--chart-line-primary) */
    stroke?: string;
    /** Stroke width. Default: 2.5 */
    strokeWidth?: number;
    /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
    yAxisId?: number | string;
}

import {
    type RefObject,
    useCallback,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

import type { LoadingStyle } from "./chart-phase";
import type { SeriesPointMarkerStyle } from "./series-point-marker";

import {
    chartCssVars as chartCssVariables,
    useChartStable,
    useYScale,
} from "./chart-context";
import {
    type FadeEdges,
    fadeGradientStops,
    resolveFadeSides,
    viewportFadeGradientAttrs as viewportFadeGradientAttributes,
} from "./fade-edges";
import {
    type LineLoadingPulseMode,
    LineLoadingPulseStroke,
    resolveLineLoadingPulseMode,
} from "./line-loading-pulse";
import { LINE_LOADING_LOOP_PAUSE_MS } from "./line-loading-timing";
import { LineLoadingSweep } from "./loading-sweep";
import {
    resolveDashTailBounds,
    usePathStrokeMetrics,
} from "./path-stroke-utils";
import { SeriesDashTailOverlay } from "./series-dash-tail-overlay";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";
import { SeriesMarkers } from "./series-markers";
import { useAnimatedSeriesPath } from "./use-animated-series-path";

// CurveFactory type - simplified version compatible with visx
// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

export function Line({
    animate = true,
    curve = curveNatural,
    dashArray = "6,4",
    dashFromIndex,
    dataKey,
    fadeEdges = true,
    loading,
    loadingPulseMode,
    loadingStroke = chartCssVariables.foreground,
    loadingStrokeOpacity = 0.5,
    loadingStyle = "pulse",
    markers,
    onLoadingPulseCycleComplete,
    showHighlight = true,
    showMarkers = false,
    stroke = chartCssVariables.linePrimary,
    strokeWidth = 2.5,
    yAxisId,
}: LineProperties) {
    // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
    // `<SeriesHighlightLayer>` so this component (and its expensive
    // <SeriesDashTailOverlay> child) does not re-render on cursor motion.
    // The reveal-clip is now a single shared clipPath at the chart-shell
    // level (`time-series-chart-shell.tsx`); we no longer render a per-line
    // `<ChartRevealClip>` or read `revealEpoch` here.
    const {
        chartPhase,
        data,
        innerHeight,
        innerWidth,
        lines,
        notifyLoadingPulseComplete,
        renderData,
        xAccessor,
        xScale,
        yDomainTweenDuration,
    } = useChartStable();
    const yScale = useYScale(yAxisId);
    const useDataTransitionPath = animate && chartPhase === "ready";
    const { pathD: animatedPathD } = useAnimatedSeriesPath({
        chartPhase,
        curve,
        dataKey,
        durationMs: yDomainTweenDuration,
        enabled: useDataTransitionPath,
        innerWidth,
        renderData,
        xAccessor,
        xScale,
        yScale,
    });

    const phasePulseMode = resolveLineLoadingPulseMode(chartPhase);
    const pulseMode =
        loading === false
            ? null
            : (loadingPulseMode ??
              (loading === true ? "loop" : phasePulseMode));
    const showLoadingPulse = pulseMode != undefined;
    const [pulseEpoch, setPulseEpoch] = useState(0);
    const effectiveShowHighlight = showHighlight && !showLoadingPulse;

    const handleLoadingPulseComplete = useCallback(() => {
        onLoadingPulseCycleComplete?.();
        if (pulseMode === "loop") {
            globalThis.setTimeout(() => {
                setPulseEpoch((epoch) => epoch + 1);
            }, LINE_LOADING_LOOP_PAUSE_MS);
            return;
        }
        notifyLoadingPulseComplete?.();
    }, [notifyLoadingPulseComplete, onLoadingPulseCycleComplete, pulseMode]);

    const seriesIndex = useMemo(() => {
        const index = lines.findIndex((line) => line.dataKey === dataKey);
        return Math.max(index, 0);
    }, [lines, dataKey]);

    const pathReference = useRef<SVGPathElement>(null);
    const { pathD, pathLength } = usePathStrokeMetrics(pathReference, [
        renderData,
        innerWidth,
        dashFromIndex,
        animate,
        useDataTransitionPath ? animatedPathD : null,
    ]);

    const reactId = useId();
    const gradientId = `line-gradient-${dataKey}-${reactId}`;

    const getY = useCallback(
        (d: Record<string, unknown>) => {
            const value = d[dataKey];
            return typeof value === "number" ? (yScale(value) ?? 0) : 0;
        },
        [dataKey, yScale]
    );

    const hasDashTail = resolveDashTailBounds(dashFromIndex, data.length);
    const fadeSides = resolveFadeSides(fadeEdges);
    const lineStroke = fadeSides.any ? `url(#${gradientId})` : stroke;
    const fadeStops = fadeSides.any ? fadeGradientStops(fadeSides) : null;
    const showSeriesStroke =
        chartPhase === "revealing" ||
        chartPhase === "ready" ||
        chartPhase === "exitingReady";
    let visibleStroke = "transparent";
    if (showSeriesStroke && !hasDashTail) {
        visibleStroke = lineStroke;
    }

    return (
        <>
            {fadeStops ? (
                <defs>
                    <linearGradient
                        id={gradientId}
                        {...viewportFadeGradientAttributes(innerWidth)}
                    >
                        {fadeStops.map((stop) => (
                            <stop
                                key={stop.offset}
                                offset={stop.offset}
                                style={{
                                    stopColor: stroke,
                                    stopOpacity: stop.opacity,
                                }}
                            />
                        ))}
                    </linearGradient>
                </defs>
            ) : null}

            <SeriesHoverDim
                dimOpacity={0.3}
                enabled={effectiveShowHighlight}
                seriesIndex={seriesIndex}
            >
                <LineSeriesStroke
                    animatedPathD={animatedPathD}
                    curve={curve}
                    getY={getY}
                    pathRef={pathReference}
                    renderData={renderData}
                    strokeWidth={strokeWidth}
                    useDataTransitionPath={useDataTransitionPath}
                    visibleStroke={visibleStroke}
                    xAccessor={xAccessor}
                    xScale={xScale}
                />

                <SeriesDashTailOverlay
                    dashArray={dashArray}
                    dashFromIndex={dashFromIndex}
                    data={data}
                    innerHeight={innerHeight}
                    innerWidth={innerWidth}
                    pathD={pathD}
                    pathLength={pathLength}
                    stroke={lineStroke}
                    strokeWidth={strokeWidth}
                    xAccessor={xAccessor}
                    xScale={xScale}
                />
            </SeriesHoverDim>

            {showMarkers ? (
                <SeriesMarkers
                    animate={animate}
                    dataKey={dataKey}
                    {...markers}
                    fill={markers?.fill ?? stroke}
                    stroke={markers?.stroke ?? markers?.fill ?? stroke}
                />
            ) : null}

            <SeriesHighlightLayer
                enabled={effectiveShowHighlight}
                height={innerHeight}
                pathRef={pathReference}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />

            <LineLoadingOverlays
                curve={curve}
                handleLoadingPulseComplete={handleLoadingPulseComplete}
                innerWidth={innerWidth}
                loadingStroke={loadingStroke}
                loadingStrokeOpacity={loadingStrokeOpacity}
                loadingStyle={loadingStyle}
                pathD={pathD}
                pulseEpoch={pulseEpoch}
                pulseMode={pulseMode}
                showLoadingPulse={showLoadingPulse}
                strokeWidth={strokeWidth}
            />
        </>
    );
}

function LineLoadingOverlays({
    curve,
    handleLoadingPulseComplete,
    innerWidth,
    loadingStroke,
    loadingStrokeOpacity,
    loadingStyle,
    pathD,
    pulseEpoch,
    pulseMode,
    showLoadingPulse,
    strokeWidth,
}: {
    curve: CurveFactory;
    handleLoadingPulseComplete: () => void;
    innerWidth: number;
    loadingStroke: string;
    loadingStrokeOpacity: number;
    loadingStyle: LoadingStyle;
    pathD: null | string;
    pulseEpoch: number;
    pulseMode: LineLoadingPulseMode | null;
    showLoadingPulse: boolean;
    strokeWidth: number;
}) {
    const sweepLoading =
        showLoadingPulse && innerWidth > 0 && loadingStyle === "sweep";
    const pulseLoading = showLoadingPulse && innerWidth > 0 && !sweepLoading;

    return (
        <>
            {sweepLoading ? (
                <LineLoadingSweep
                    curve={curve}
                    key="loading-sweep"
                    mode={pulseMode ?? "loop"}
                    onTransitionComplete={handleLoadingPulseComplete}
                    stroke={loadingStroke}
                    strokeOpacity={loadingStrokeOpacity}
                    strokeWidth={strokeWidth}
                />
            ) : null}
            {pulseLoading && pathD ? (
                <LineLoadingPulseStroke
                    key="loading-pulse"
                    loopEpoch={pulseEpoch}
                    mode={pulseMode ?? undefined}
                    onCycleComplete={handleLoadingPulseComplete}
                    pathD={pathD}
                    stroke={loadingStroke}
                    strokeOpacity={loadingStrokeOpacity}
                    strokeWidth={strokeWidth}
                />
            ) : null}
        </>
    );
}

function LineSeriesStroke({
    animatedPathD,
    curve,
    getY,
    pathRef,
    renderData,
    strokeWidth,
    useDataTransitionPath,
    visibleStroke,
    xAccessor,
    xScale,
}: {
    animatedPathD: string;
    curve: CurveFactory;
    getY: (datum: Record<string, unknown>) => number;
    pathRef: RefObject<null | SVGPathElement>;
    renderData: Record<string, unknown>[];
    strokeWidth: number;
    useDataTransitionPath: boolean;
    visibleStroke: string;
    xAccessor: (datum: Record<string, unknown>) => Date;
    xScale: (value: Date) => number | undefined;
}) {
    if (useDataTransitionPath && animatedPathD) {
        return (
            <path
                d={animatedPathD}
                fill="none"
                ref={pathRef}
                stroke={visibleStroke}
                strokeLinecap="round"
                strokeWidth={strokeWidth}
            />
        );
    }

    return (
        <LinePath
            curve={curve}
            data={renderData}
            innerRef={pathRef}
            stroke={visibleStroke}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            x={(d) => xScale(xAccessor(d)) ?? 0}
            y={getY}
        />
    );
}

Line.displayName = "Line";

export default Line;
