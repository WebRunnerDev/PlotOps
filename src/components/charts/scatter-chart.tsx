"use client";

import type { Transition } from "motion/react";

import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import {
    Children,
    type CSSProperties,
    isValidElement,
    type ReactElement,
    type ReactNode,
    type RefObject,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { cn } from "@/shared/lib/utils";

import { DEFAULT_ANIMATION_EASING } from "./animation";
import {
    isClipExcludedComponent,
    isPostOverlayComponent,
    isUnderlayComponent,
    resolveChartChildElement,
} from "./chart-child-passthrough";
import {
    type ChartContextValue,
    ChartProvider,
    defaultScatterColors,
    type LineConfig,
    type Margin,
} from "./chart-context";
import { isGradientDefComponent, isPatternDefComponent } from "./chart-defs";
import { shortDateFmt } from "./chart-formatters";
import { type ChartPhase, DEFAULT_CHART_LIFECYCLE } from "./chart-phase";
import { extractReferenceAreaConfigs } from "./reference-area-config";
import { Scatter, type ScatterProperties } from "./scatter";
import { useScatterChartInteraction } from "./use-scatter-chart-interaction";
import { buildYScalesForLines, getPrimaryYScale } from "./y-axis-scales";

export interface ScatterChartProperties {
    /** Animation duration in milliseconds. Default: 1100 */
    animationDuration?: number;
    /** CSS easing for the point reveal. */
    animationEasing?: string;
    /** Aspect ratio as "width / height". Default: "2 / 1" */
    aspectRatio?: string;
    /** Child components (Scatter, Grid, ChartTooltip, XAxis, etc.) */
    children: ReactNode;
    /** Additional class name for the container */
    className?: string;
    /** Data array — each item should have a date field and numeric values */
    data: Record<string, unknown>[];
    enterTransition?: Transition;
    /**
     * Accessible name. With `onPointClick` the chart becomes one focusable
     * stop: ← / → step through points, Enter opens the shown one.
     */
    label?: string;
    /** Chart margins */
    margin?: Partial<Margin>;
    onPhaseChange?: (phase: ChartPhase) => void;
    /** Click (or Enter) on a point. Its row from `data` and index. */
    onPointClick?: (point: Record<string, unknown>, index: number) => void;
    revealSignature?: string;
    /** Inline container styles. */
    style?: CSSProperties;
    /** Key in data for the x-axis (date). Default: "date" */
    xDataKey?: string;
    /** Fixed x-domain (e.g. the report period). Default: the data's extent. */
    xDomain?: [Date, Date];
    /** Lowest y-domain top, so reference lines above the data stay in view. */
    yDomainMinTop?: number;
}

const DEFAULT_MARGIN: Margin = { bottom: 40, left: 40, right: 40, top: 40 };

/**
 * Bklit time-series scatter chart, ported onto the PlotOps chart context.
 * Points come from `<Scatter>` children (one series per child); hover finds
 * the nearest point in 2D and dims the rest.
 */
export function ScatterChart({
    animationDuration = 1100,
    animationEasing = DEFAULT_ANIMATION_EASING,
    aspectRatio = "2 / 1",
    children,
    className = "",
    data,
    enterTransition,
    label,
    margin: marginProperty,
    onPhaseChange,
    onPointClick,
    revealSignature = "",
    style,
    xDataKey = "date",
    xDomain,
    yDomainMinTop,
}: ScatterChartProperties) {
    const containerReference = useRef<HTMLDivElement>(null);
    const margin = { ...DEFAULT_MARGIN, ...marginProperty };
    const focusable = Boolean(onPointClick);

    return (
        <div
            aria-label={label}
            className={cn(
                "relative w-full",
                focusable &&
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                className
            )}
            ref={containerReference}
            role={label ? "group" : undefined}
            style={{
                ...(aspectRatio ? { aspectRatio } : undefined),
                touchAction: "pan-y",
                ...style,
            }}
            tabIndex={focusable ? 0 : undefined}
        >
            <ParentSize debounceTime={10}>
                {({ height, width }) =>
                    width < 10 || height < 10 ? null : (
                        <ScatterChartInner
                            animationDuration={animationDuration}
                            animationEasing={animationEasing}
                            containerRef={containerReference}
                            data={data}
                            enterTransition={enterTransition}
                            height={height}
                            margin={margin}
                            onPhaseChange={onPhaseChange}
                            onPointClick={onPointClick}
                            revealSignature={revealSignature}
                            width={width}
                            xDataKey={xDataKey}
                            xDomain={xDomain}
                            yDomainMinTop={yDomainMinTop}
                        >
                            {children}
                        </ScatterChartInner>
                    )
                }
            </ParentSize>
        </div>
    );
}

interface ScatterChartInnerProperties {
    animationDuration: number;
    animationEasing: string;
    children: ReactNode;
    containerRef: RefObject<HTMLDivElement | null>;
    data: Record<string, unknown>[];
    enterTransition?: Transition;
    height: number;
    margin: Margin;
    onPhaseChange?: (phase: ChartPhase) => void;
    onPointClick?: (point: Record<string, unknown>, index: number) => void;
    revealSignature: string;
    width: number;
    xDataKey: string;
    xDomain?: [Date, Date];
    yDomainMinTop?: number;
}

function ScatterChartInner({
    animationDuration,
    animationEasing,
    children,
    containerRef,
    data,
    enterTransition,
    height,
    margin,
    onPhaseChange,
    onPointClick,
    revealSignature,
    width,
    xDataKey,
    xDomain,
    yDomainMinTop = 0,
}: ScatterChartInnerProperties) {
    const lines = useMemo(() => extractScatterConfigs(children), [children]);
    const [isLoaded, setIsLoaded] = useState(() => animationDuration <= 0);
    const [revealEpoch, setRevealEpoch] = useState(1);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xAccessor = useMemo(
        () =>
            (datum: Record<string, unknown>): Date => {
                const value = datum[xDataKey];
                return value instanceof Date
                    ? value
                    : new Date(value as number | string);
            },
        [xDataKey]
    );

    // Keep the outermost points (and their hover ring) off the plot edges.
    const xPadding = useMemo(() => {
        const maxRadius = Math.max(5, ...lines.map((line) => line.strokeWidth));
        return maxRadius + 6;
    }, [lines]);

    const xScale = useMemo(() => {
        const times = data.map((datum) => xAccessor(datum).getTime());
        const domain = xDomain ?? [
            new Date(Math.min(...times)),
            new Date(Math.max(...times)),
        ];
        return scaleTime<number>({
            domain,
            range: [xPadding, Math.max(xPadding, innerWidth - xPadding)],
        });
    }, [data, innerWidth, xAccessor, xDomain, xPadding]);

    const yScales = useMemo(
        () =>
            buildYScalesForLines({
                innerHeight,
                lines,
                resolveDomain: (dataKeys) => {
                    let maxValue = 0;
                    for (const datum of data) {
                        for (const key of dataKeys) {
                            const value = datum[key];
                            if (typeof value === "number" && value > maxValue) {
                                maxValue = value;
                            }
                        }
                    }
                    const top = Math.max(maxValue * 1.1, yDomainMinTop);
                    return [0, top <= 0 ? 1 : top];
                },
            }),
        [data, innerHeight, lines, yDomainMinTop]
    );
    const yScale = getPrimaryYScale(
        yScales,
        scaleLinear<number>({ domain: [0, 100], range: [innerHeight, 0] })
    );
    const yDomain = yScale.domain() as [number, number];

    const dateLabels = useMemo(
        () => data.map((datum) => shortDateFmt.format(xAccessor(datum))),
        [data, xAccessor]
    );

    // Replay the reveal when motion settings change ("store previous props
    // in state" instead of setState in an effect).
    const [revealKey, setRevealKey] = useState({
        animationDuration,
        revealSignature,
    });
    if (
        revealKey.animationDuration !== animationDuration ||
        revealKey.revealSignature !== revealSignature
    ) {
        setRevealKey({ animationDuration, revealSignature });
        setRevealEpoch((epoch) => epoch + 1);
        setIsLoaded(animationDuration <= 0);
    }

    useEffect(() => {
        const timer = globalThis.setTimeout(() => {
            setIsLoaded(true);
        }, animationDuration);
        return () => globalThis.clearTimeout(timer);
    }, [animationDuration, revealSignature]);

    useEffect(() => {
        onPhaseChange?.(isLoaded ? "ready" : "revealing");
    }, [isLoaded, onPhaseChange]);

    const {
        clearTooltip,
        interactionHandlers,
        interactionStyle,
        onKeyDown,
        setTooltipData,
        tooltipData,
    } = useScatterChartInteraction({
        canInteract: isLoaded,
        data,
        lines,
        margin,
        onPointClick,
        xAccessor,
        xScale,
        yScale,
        yScales,
    });

    // Keyboard lives on the focusable container rendered by ScatterChart.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !onPointClick) return;
        container.addEventListener("keydown", onKeyDown);
        container.addEventListener("blur", clearTooltip);
        return () => {
            container.removeEventListener("keydown", onKeyDown);
            container.removeEventListener("blur", clearTooltip);
        };
    }, [clearTooltip, containerRef, onKeyDown, onPointClick]);

    const referenceAreas = useMemo(
        () => extractReferenceAreaConfigs(children),
        [children]
    );

    const defsChildren: ReactElement[] = [];
    const clipExcludedChildren: ReactElement[] = [];
    const underlayChildren: ReactElement[] = [];
    const preOverlayChildren: ReactElement[] = [];
    const postOverlayChildren: ReactElement[] = [];

    Children.forEach(children, (rawChild) => {
        if (!isValidElement(rawChild)) return;
        const child = resolveChartChildElement(rawChild);
        if (isGradientDefComponent(child)) {
            defsChildren.push(child);
        } else if (isPatternDefComponent(child)) {
            preOverlayChildren.push(child);
        } else if (isPostOverlayComponent(child)) {
            postOverlayChildren.push(child);
        } else if (isClipExcludedComponent(child)) {
            clipExcludedChildren.push(child);
        } else if (isUnderlayComponent(child)) {
            underlayChildren.push(child);
        } else {
            preOverlayChildren.push(child);
        }
    });

    const contextValue: ChartContextValue = {
        ...DEFAULT_CHART_LIFECYCLE,
        animationDuration,
        animationEasing,
        columnWidth: data.length < 2 ? 0 : innerWidth / (data.length - 1),
        containerRef,
        data,
        dateLabels,
        enterTransition,
        height,
        innerHeight,
        innerWidth,
        isLoaded,
        lines,
        margin,
        referenceAreas,
        renderData: data,
        revealEpoch,
        setTooltipData,
        tooltipData,
        width,
        xAccessor,
        xScale,
        yDomainSkeletonByAxis: { left: yDomain },
        yDomainTargetByAxis: { left: yDomain },
        yScale,
        yScales,
    };

    return (
        <ChartProvider value={contextValue}>
            <svg
                aria-hidden="true"
                className="overflow-visible"
                height={height}
                width={width}
            >
                {defsChildren.length > 0 && <defs>{defsChildren}</defs>}
                <g
                    {...interactionHandlers}
                    style={interactionStyle}
                    transform={`translate(${margin.left},${margin.top})`}
                >
                    <rect
                        fill="transparent"
                        height={innerHeight}
                        width={innerWidth}
                        x={0}
                        y={0}
                    />
                    {clipExcludedChildren}
                    {underlayChildren}
                    {preOverlayChildren}
                    {postOverlayChildren}
                </g>
            </svg>
        </ChartProvider>
    );
}

function extractScatterConfigs(children: ReactNode): LineConfig[] {
    const configs: LineConfig[] = [];
    let seriesIndex = 0;

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return;
        const childType = child.type as { displayName?: string; name?: string };
        const componentName =
            typeof child.type === "function"
                ? childType.displayName || childType.name || ""
                : "";
        if (componentName !== "Scatter" && child.type !== Scatter) return;

        const properties = child.props as ScatterProperties;
        const seriesColor =
            defaultScatterColors[seriesIndex % defaultScatterColors.length] ??
            defaultScatterColors[0];
        configs.push({
            dataKey: properties.dataKey,
            stroke: properties.fill || properties.stroke || seriesColor,
            strokeWidth: properties.radius ?? 5,
            yAxisId: properties.yAxisId,
        });
        seriesIndex += 1;
    });

    return configs;
}

export { Scatter, type ScatterProperties } from "./scatter";

export default ScatterChart;
