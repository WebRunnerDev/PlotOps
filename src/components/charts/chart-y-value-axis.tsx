"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/utils";

import { useChart, useChartStable, useYScale } from "./chart-context";
import { intFmt } from "./chart-formatters";
import { resolveYAxisTickCount } from "./y-axis-ticks";

export interface ChartYValueAxisProperties {
    /** Max tick count hint for the scale. Default: 4 */
    numTicks?: number;
    /** Y-scale axis id. Default: primary left axis. */
    yAxisId?: number | string;
}

/**
 * Left-side numeric labels for line/bar value scales (recognition over recall).
 * Portaled into the chart container so labels sit in the left margin.
 */
export function ChartYValueAxis(properties: ChartYValueAxisProperties) {
    const { containerRef } = useChartStable();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    return <ChartYValueAxisInner {...properties} container={container} />;
}

ChartYValueAxis.displayName = "YAxis";

const ChartYValueAxisInner = memo(function ChartYValueAxisInner({
    container,
    numTicks = 4,
    yAxisId,
}: ChartYValueAxisProperties & { container: HTMLDivElement }) {
    const { margin } = useChart();
    const yScale = useYScale(yAxisId);
    const tickCount = resolveYAxisTickCount(numTicks);

    const ticks = useMemo(() => {
        const values = yScale.ticks ? yScale.ticks(tickCount) : [];
        return values
            .filter((value) => value >= 0)
            .map((value) => ({
                label: intFmt(value),
                y: yScale(value) + margin.top,
            }));
    }, [margin.top, tickCount, yScale]);

    if (ticks.length === 0) {
        return null;
    }

    return createPortal(
        <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0"
            style={{ left: 0, width: margin.left }}
        >
            {ticks.map((tick) => (
                <span
                    className={cn(
                        "absolute right-2 -translate-y-1/2 text-right text-[10px] tabular-nums text-muted-foreground"
                    )}
                    key={`${tick.label}-${tick.y}`}
                    style={{ top: tick.y }}
                >
                    {tick.label}
                </span>
            ))}
        </div>,
        container
    );
});
