"use client";

import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/utils";

import { useChart, useChartStable } from "./chart-context";

export interface BarYAxisProperties {
    /** Maximum number of labels to show. Default: 20 */
    maxLabels?: number;
    /** Whether to show all labels or skip some for dense data. Default: true */
    showAllLabels?: boolean;
}

interface BarYAxisLabelProperties {
    bandHeight: number;
    isHovered: boolean;
    label: string;
    y: number;
}

export function BarYAxis(properties: BarYAxisProperties) {
    const { barScale, containerRef } = useChartStable();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    if (!barScale) {
        return null;
    }

    return <BarYAxisInner {...properties} container={container} />;
}

function BarYAxisLabel({
    bandHeight,
    isHovered,
    label,
    y,
}: BarYAxisLabelProperties) {
    return (
        <div
            className="absolute right-0 flex items-center justify-end pr-2"
            style={{
                height: bandHeight,
                top: y,
            }}
        >
            <motion.span
                animate={{
                    color: isHovered
                        ? "var(--foreground)"
                        : "var(--chart-label, var(--color-zinc-500))",
                    opacity: isHovered ? 1 : 0.7,
                }}
                className={cn("truncate whitespace-nowrap text-right text-xs")}
                initial={{
                    color: "var(--chart-label, var(--color-zinc-500))",
                    opacity: 0.7,
                }}
                style={{ maxWidth: 70 }}
                transition={{ duration: 0.15 }}
            >
                {label}
            </motion.span>
        </div>
    );
}

const BarYAxisInner = memo(function BarYAxisInner({
    container,
    maxLabels = 20,
    showAllLabels = true,
}: BarYAxisProperties & { container: HTMLDivElement }) {
    const { bandWidth, barScale, barXAccessor, data, hoveredBarIndex, margin } =
        useChart();

    // Generate labels for each bar
    const labelsToShow = useMemo(() => {
        if (!(barScale && bandWidth && barXAccessor)) {
            return [];
        }

        const allLabels = data.map((d, index) => {
            const label = barXAccessor(d);
            const bandY = barScale(label) ?? 0;
            // Center the label vertically within the band
            const y = bandY + margin.top;
            return { bandHeight: bandWidth, index: index, label, y };
        });

        // If showAllLabels is true or we have fewer than maxLabels, show all
        if (showAllLabels || allLabels.length <= maxLabels) {
            return allLabels;
        }

        // Otherwise, skip some labels to avoid crowding
        const step = Math.ceil(allLabels.length / maxLabels);
        return allLabels.filter((_, index) => index % step === 0);
    }, [
        barScale,
        bandWidth,
        barXAccessor,
        data,
        margin.top,
        showAllLabels,
        maxLabels,
    ]);

    return createPortal(
        <div
            className="pointer-events-none absolute top-0 bottom-0"
            style={{
                left: 0,
                width: margin.left,
            }}
        >
            {labelsToShow.map((item) => (
                <BarYAxisLabel
                    bandHeight={item.bandHeight}
                    isHovered={hoveredBarIndex === item.index}
                    key={`${item.label}-${item.y}`}
                    label={item.label}
                    y={item.y}
                />
            ))}
        </div>,
        container
    );
});

BarYAxis.displayName = "BarYAxis";

export default BarYAxis;
