"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

import { useChartStable, useYScale } from "./chart-context";
import { StaticSeriesPointMarker } from "./series-point-marker";

export interface LineSeriesTerminalMarkerProperties {
    dataKey: string;
    fill?: string;
    radius?: number;
    ringGap?: number;
    stroke?: string;
    strokeWidth?: number;
    yAxisId?: number | string;
}

/** Hollow ring at the last data point — shared anchor for projection lines. */
export function LineSeriesTerminalMarker({
    dataKey,
    fill = "transparent",
    radius = 5,
    ringGap = 0,
    stroke = "var(--chart-1)",
    strokeWidth = 1.5,
    yAxisId,
}: LineSeriesTerminalMarkerProperties) {
    const {
        chartPhase,
        data,
        enterTransition,
        revealEpoch,
        xAccessor,
        xScale,
    } = useChartStable();
    const yScale = useYScale(yAxisId);

    const point = useMemo(() => {
        const lastRow = data.at(-1);
        if (!lastRow) {
            return null;
        }
        const value = lastRow[dataKey];
        if (typeof value !== "number") {
            return null;
        }
        return {
            cx: xScale(xAccessor(lastRow)) ?? 0,
            cy: yScale(value) ?? 0,
        };
    }, [data, dataKey, xAccessor, xScale, yScale]);

    const visible = isTerminalMarkerPhaseVisible(chartPhase);
    const fadeTransition =
        enterTransition && typeof enterTransition === "object"
            ? enterTransition
            : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

    if (!point) {
        return null;
    }

    return (
        <motion.g
            animate={{
                opacity: visible ? 1 : 0,
                scale: visible ? 1 : 0.55,
            }}
            initial={{ opacity: 0, scale: 0.55 }}
            key={revealEpoch ?? 0}
            style={{
                transformBox: "fill-box" as const,
                transformOrigin: `${point.cx}px ${point.cy}px`,
            }}
            transition={fadeTransition}
        >
            <StaticSeriesPointMarker
                cx={point.cx}
                cy={point.cy}
                fill={fill}
                radius={radius}
                ringGap={ringGap}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />
        </motion.g>
    );
}

function isTerminalMarkerPhaseVisible(phase: string): boolean {
    return phase === "ready" || phase === "exitingReady";
}

LineSeriesTerminalMarker.displayName = "LineSeriesTerminalMarker";

(
    LineSeriesTerminalMarker as unknown as Record<string, boolean>
).__isPostOverlay = true;

export default LineSeriesTerminalMarker;
