"use client";

import type { Transition } from "motion/react";

import { ParentSize } from "@visx/responsive";
import {
    Children,
    type CSSProperties,
    isValidElement,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from "react";

import { cn } from "@/shared/lib/utils";

import type { LineConfig, Margin } from "./chart-context";

import { Area, type AreaProperties } from "./area";
import { ChartLoadingLabel } from "./chart-loading-label";
import {
    type ChartPhase,
    type ChartStatus,
    DEFAULT_CHART_STATUS,
    DEFAULT_Y_DOMAIN_TWEEN_MS,
    resolveRestingChartPhase,
} from "./chart-phase";
import { TimeSeriesChartInner } from "./time-series-chart-shell";

export interface AreaChartProperties {
    /** Animation duration in milliseconds. Default: 1100 */
    animationDuration?: number;
    /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
    animationEasing?: string;
    /** Aspect ratio as "width / height". Default: "2 / 1". Omit to fill a sized parent. */
    aspectRatio?: string;
    /** Child components (Area, Grid, ChartTooltip, etc.) */
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
    /** Fires when the internal chart phase changes. */
    onPhaseChange?: (phase: ChartPhase) => void;
    /** Changing it replays the reveal animation. */
    revealSignature?: string;
    /** Loading vs ready — drives chart phase and loading chrome. Default: `"ready"`. */
    status?: ChartStatus;
    /** Inline container styles. */
    style?: CSSProperties;
    /** Key in data for the x-axis (date). Default: "date" */
    xDataKey?: string;
    /** Animate y-domain when status or target domain changes. Default: true */
    yDomainTween?: boolean;
    /** Animate y-domain over this duration (ms). Default: 500. */
    yDomainTweenDuration?: number;
}

const DEFAULT_MARGIN: Margin = { bottom: 40, left: 40, right: 40, top: 40 };

/** Overlays that carry a dataKey but are not series of their own. */
const AREA_DOMAIN_EXCLUDED_NAMES = new Set([
    "LineSeriesTerminalMarker",
    "PatternArea",
    "TrendLine",
]);

/**
 * Bklit area chart: the time-series shell (grid, axes, tooltip, reveal clip,
 * y-domain tween) driven by `<Area>` series instead of `<Line>`.
 */
export function AreaChart({
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
    xDataKey = "date",
    yDomainTween = true,
    yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
}: AreaChartProperties) {
    const containerReference = useRef<HTMLDivElement>(null);
    const margin = { ...DEFAULT_MARGIN, ...marginProperty };
    const lines = useMemo(() => extractAreaConfigs(children), [children]);
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
                    <TimeSeriesChartInner
                        animationDuration={animationDuration}
                        animationEasing={animationEasing}
                        chartStatus={status}
                        clipPathId="chart-area-grow-clip"
                        containerRef={containerReference}
                        data={data}
                        enterTransition={enterTransition}
                        height={height}
                        lines={lines}
                        loadingLabel={loadingLabel}
                        margin={margin}
                        onPhaseChange={handlePhaseChange}
                        revealSignature={revealSignature}
                        width={width}
                        xDataKey={xDataKey}
                        yDomainTween={yDomainTween}
                        yDomainTweenDuration={yDomainTweenDuration}
                    >
                        {children}
                    </TimeSeriesChartInner>
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

function extractAreaConfigs(children: ReactNode): LineConfig[] {
    const configs: LineConfig[] = [];

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) {
            return;
        }

        const childType = child.type as { displayName?: string; name?: string };
        const componentName =
            typeof child.type === "function"
                ? childType.displayName || childType.name || ""
                : "";
        const properties = child.props as AreaProperties | undefined;
        if (
            !properties?.dataKey ||
            AREA_DOMAIN_EXCLUDED_NAMES.has(componentName)
        ) {
            return;
        }
        if (componentName !== "Area" && child.type !== Area) {
            return;
        }

        configs.push({
            dataKey: properties.dataKey,
            stroke:
                properties.stroke ||
                properties.fill ||
                "var(--chart-line-primary)",
            strokeWidth: properties.strokeWidth || 2,
            yAxisId: properties.yAxisId,
        });
    });

    return configs;
}

export { Area, type AreaProperties } from "./area";

export default AreaChart;
