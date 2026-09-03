"use client";

import type { Transition } from "motion/react";

import { ParentSize } from "@visx/responsive";
import {
    Children,
    type CSSProperties,
    isValidElement,
    type ReactElement,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react";

import { cn } from "@/shared/lib/utils";

import type { LineConfig, Margin } from "./chart-context";

import { ChartLoadingLabel } from "./chart-loading-label";
import {
    type ChartPhase,
    type ChartStatus,
    DEFAULT_CHART_STATUS,
    DEFAULT_Y_DOMAIN_TWEEN_MS,
    resolveRestingChartPhase,
} from "./chart-phase";
import { Line, type LineProps as LineProperties } from "./line";
import { TimeSeriesChartInner } from "./time-series-chart-shell";

export interface LineChartProperties {
    /** Animation duration in milliseconds. Default: 1100 */
    animationDuration?: number;
    /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
    animationEasing?: string;
    /** Aspect ratio as "width / height". Default: "2 / 1". Omit to fill a sized parent. */
    aspectRatio?: string;
    /** Child components (Line, Grid, ChartTooltip, etc.) */
    children: ReactNode;
    /** Additional class name for the container */
    className?: string;
    /** Data array - each item should have a date field and numeric values */
    data: Record<string, unknown>[];
    enterTransition?: Transition;
    /** Centered shimmer label while loading. */
    loadingLabel?: string;
    /** Chart margins */
    margin?: Partial<Margin>;
    /** Fires when the internal chart phase changes (e.g. OG capture readiness). */
    onPhaseChange?: (phase: ChartPhase) => void;
    revealSignature?: string;
    /** Loading vs ready — drives chart phase and loading chrome. Default: `"ready"`. */
    status?: ChartStatus;
    /** Inline container styles (e.g. fixed height for brush strip). */
    style?: CSSProperties;
    /** Tween y-domain when brush changes the visible x-range. Default: false */
    tweenYDomainOnXDomainChange?: boolean;
    /** Key in data for the x-axis (date). Default: "date" */
    xDataKey?: string;
    /** Visible x-domain for brush zoom. */
    xDomain?: [Date, Date];
    /** Full dataset length for x-scale padding when `xDomain` is set. */
    xDomainSlotCount?: number;
    /** Animate y-domain when status or target domain changes. Default: true */
    yDomainTween?: boolean;
    /** Animate y-domain over this duration (ms) on status transitions. Default: 500. */
    yDomainTweenDuration?: number;
}

const DEFAULT_MARGIN: Margin = { bottom: 40, left: 40, right: 40, top: 40 };

/** Series renderers that carry a dataKey but must not drive the shared y-domain. */
const LINE_DOMAIN_EXCLUDED_NAMES = new Set([
    "Area",
    "Bar",
    "Candlestick",
    "LineSeriesTerminalMarker",
    "PatternArea",
    "ProfitLossLine",
    "Scatter",
    "SeriesBar",
]);

interface ChartInnerProperties {
    animationDuration: number;
    animationEasing?: string;
    chartStatus: ChartStatus;
    children: ReactNode;
    containerRef: React.RefObject<HTMLDivElement | null>;
    data: Record<string, unknown>[];
    enterTransition?: Transition;
    height: number;
    loadingLabel?: string;
    margin: Margin;
    onPhaseChange: (phase: ChartPhase) => void;
    revealSignature?: string;
    tweenYDomainOnXDomainChange?: boolean;
    width: number;
    xDataKey: string;
    xDomain?: [Date, Date];
    xDomainSlotCount?: number;
    yDomainTween: boolean;
    yDomainTweenDuration: number;
}

export function LineChart({
    animationDuration = 1100,
    animationEasing,
    aspectRatio = "2 / 1",
    children,
    className = "",
    data,
    enterTransition,
    loadingLabel,
    margin: marginProperty,
    onPhaseChange,
    revealSignature,
    status = DEFAULT_CHART_STATUS,
    style,
    tweenYDomainOnXDomainChange = false,
    xDataKey = "date",
    xDomain,
    xDomainSlotCount,
    yDomainTween = true,
    yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
}: LineChartProperties) {
    const containerReference = useRef<HTMLDivElement>(null);
    const margin = { ...DEFAULT_MARGIN, ...marginProperty };
    const [chartPhase, setChartPhase] = useState<ChartPhase>(() =>
        resolveRestingChartPhase(status)
    );
    const handlePhaseChange = useCallback(
        (phase: ChartPhase) => {
            setChartPhase(phase);
            onPhaseChange?.(phase);
        },
        [onPhaseChange]
    );

    const showLoadingLabel = Boolean(
        loadingLabel?.trim() &&
        (chartPhase === "loading" ||
            chartPhase === "exiting" ||
            chartPhase === "gridTweenReady" ||
            chartPhase === "revealingLoading")
    );

    return (
        <div
            className={cn("relative w-full", className)}
            ref={containerReference}
            style={{
                ...(aspectRatio ? { aspectRatio } : undefined),
                touchAction: "none",
                ...style,
            }}
        >
            <ParentSize debounceTime={10}>
                {({ height, width }) => (
                    <ChartInner
                        animationDuration={animationDuration}
                        animationEasing={animationEasing}
                        chartStatus={status}
                        containerRef={containerReference}
                        data={data}
                        enterTransition={enterTransition}
                        height={height}
                        loadingLabel={loadingLabel}
                        margin={margin}
                        onPhaseChange={handlePhaseChange}
                        revealSignature={revealSignature}
                        tweenYDomainOnXDomainChange={
                            tweenYDomainOnXDomainChange
                        }
                        width={width}
                        xDataKey={xDataKey}
                        xDomain={xDomain}
                        xDomainSlotCount={xDomainSlotCount}
                        yDomainTween={yDomainTween}
                        yDomainTweenDuration={yDomainTweenDuration}
                    >
                        {children}
                    </ChartInner>
                )}
            </ParentSize>
            {showLoadingLabel ? (
                <ChartLoadingLabel
                    exiting={chartPhase !== "loading"}
                    text={loadingLabel}
                />
            ) : null}
        </div>
    );
}

function ChartInner({
    animationDuration,
    animationEasing,
    chartStatus,
    children,
    containerRef,
    data,
    enterTransition,
    height,
    loadingLabel,
    margin,
    onPhaseChange,
    revealSignature,
    tweenYDomainOnXDomainChange,
    width,
    xDataKey,
    xDomain,
    xDomainSlotCount,
    yDomainTween,
    yDomainTweenDuration,
}: ChartInnerProperties) {
    const lines = useMemo(() => extractLineConfigs(children), [children]);

    return (
        <TimeSeriesChartInner
            animationDuration={animationDuration}
            animationEasing={animationEasing}
            chartStatus={chartStatus}
            clipPathId="chart-grow-clip"
            containerRef={containerRef}
            data={data}
            enterTransition={enterTransition}
            height={height}
            lines={lines}
            loadingLabel={loadingLabel}
            margin={margin}
            onPhaseChange={onPhaseChange}
            revealSignature={revealSignature}
            tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
            width={width}
            xDataKey={xDataKey}
            xDomain={xDomain}
            xDomainSlotCount={xDomainSlotCount}
            yDomainTween={yDomainTween}
            yDomainTweenDuration={yDomainTweenDuration}
        >
            {children}
        </TimeSeriesChartInner>
    );
}

function extractLineConfigs(children: ReactNode): LineConfig[] {
    const configs: LineConfig[] = [];

    const visit = (node: ReactNode) => {
        Children.forEach(node, (child) => {
            if (!isValidElement(child)) {
                return;
            }

            const properties = child.props as LineProperties | undefined;

            if (registersLineDomain(child, properties) && properties?.dataKey) {
                configs.push({
                    dataKey: properties.dataKey,
                    stroke: properties.stroke || "var(--chart-line-primary)",
                    strokeWidth: properties.strokeWidth || 2.5,
                    yAxisId: properties.yAxisId,
                });
                return;
            }

            const childProperties = child.props as
                undefined | { children?: ReactNode };
            if (childProperties?.children) {
                visit(childProperties.children);
            }
        });
    };

    visit(children);
    return configs;
}

function getChildComponentName(child: ReactElement) {
    const childType = child.type as { displayName?: string; name?: string };
    return typeof child.type === "function"
        ? childType.displayName || childType.name || ""
        : "";
}

function registersLineDomain(
    child: ReactElement,
    properties: LineProperties | undefined
) {
    if (!properties?.dataKey) {
        return false;
    }

    const componentName = getChildComponentName(child);
    if (componentName === "Line" || child.type === Line) {
        return true;
    }
    if (LINE_DOMAIN_EXCLUDED_NAMES.has(componentName)) {
        return false;
    }
    // MDX / duplicate bundle instances may not share the same `Line` reference.
    return (
        typeof properties.dataKey === "string" && properties.dataKey.length > 0
    );
}

export { Line, type LineProps } from "./line";

export default LineChart;
