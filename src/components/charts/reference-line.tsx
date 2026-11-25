"use client";

import { motion } from "motion/react";

import { useChartStable, useYScale } from "./chart-context";

export interface ReferenceLineProperties {
    /** Text drawn at the right end of the line. */
    label?: string;
    /** Draw the label under the line instead of above it. Default: false */
    labelBelow?: boolean;
    /** Line color. Default: var(--chart-line-secondary) */
    stroke?: string;
    /** SVG dash pattern. Omit for a solid line. */
    strokeDasharray?: string;
    /** Stroke width. Default: 1.5 */
    strokeWidth?: number;
    /** Data value the line sits at. */
    y: number;
    /** Y-scale group id. Default: primary left axis. */
    yAxisId?: number | string;
}

/**
 * Horizontal threshold line across the plot (median, target, limit) with
 * an optional right-aligned label. Fades in once the chart has revealed.
 */
export function ReferenceLine({
    label,
    labelBelow = false,
    stroke = "var(--chart-line-secondary)",
    strokeDasharray,
    strokeWidth = 1.5,
    y,
    yAxisId,
}: ReferenceLineProperties) {
    const { innerWidth, isLoaded } = useChartStable();
    const yScale = useYScale(yAxisId);
    const lineY = yScale(y) ?? 0;

    return (
        <motion.g
            animate={{ opacity: isLoaded ? 1 : 0 }}
            className="pointer-events-none"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
            <line
                stroke={stroke}
                strokeDasharray={strokeDasharray}
                strokeWidth={strokeWidth}
                x1={0}
                x2={innerWidth}
                y1={lineY}
                y2={lineY}
            />
            {label ? (
                <text
                    className="fill-muted-foreground text-[11px]"
                    paintOrder="stroke"
                    stroke="var(--chart-background)"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    textAnchor="end"
                    x={innerWidth - 4}
                    y={lineY + (labelBelow ? 13 : -5)}
                >
                    {label}
                </text>
            ) : null}
        </motion.g>
    );
}

ReferenceLine.displayName = "ReferenceLine";

export default ReferenceLine;
