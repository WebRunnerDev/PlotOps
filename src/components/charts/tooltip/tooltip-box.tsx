"use client";

import type { RefObject } from "react";

import { motion, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/lib/utils";

import { type SpringConfig, useChartConfig } from "../chart-config-context";
import { chartCssVars as chartCssVariables } from "../chart-context";

export interface TooltipBoxProperties {
    /** Animate panel position with a spring. Default: true */
    animate?: boolean;
    /**
     * Tooltip panel background color (CSS variable or color value).
     * Default: `var(--chart-tooltip-background)`.
     */
    backgroundColor?: string;
    /** Tooltip content */
    children: React.ReactNode;
    /** Custom class name */
    className?: string;
    /** Container height for bounds clamping */
    containerHeight: number;
    /** Container ref for portal rendering */
    containerRef: RefObject<HTMLDivElement | null>;
    /** Container width for flip detection */
    containerWidth: number;
    /** Fade/scale the panel on show. Default: true */
    entrance?: boolean;
    /** Force flip direction (for custom positioning) */
    flipped?: boolean;
    /** Override left position (bypasses internal calculation) */
    left?: number | ReturnType<typeof useSpring>;
    /** Offset from the target position */
    offset?: number;
    /** Inline styles for the inner tooltip panel. */
    panelStyle?: React.CSSProperties;
    /** Per-chart override; falls back to `ChartConfigProvider.tooltipBoxSpring`. */
    springConfig?: SpringConfig;
    /** Override top position (bypasses internal calculation) */
    top?: number | ReturnType<typeof useSpring>;
    /** Whether the tooltip is visible */
    visible: boolean;
    /** X position in pixels (relative to container) */
    x: number;
    /** Y position in pixels (relative to container) */
    y: number;
}

// Inner-only-on-visible so `useSpring` initializes at the cursor's actual x/y
// instead of (0, 0) on first hover.
export function TooltipBox(properties: TooltipBoxProperties) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = properties.containerRef.current;
    if (!(mounted && container)) {
        return null;
    }
    if (!properties.visible) {
        return null;
    }
    return <TooltipBoxInner {...properties} container={container} />;
}

function TooltipBoxInner({
    animate = true,
    backgroundColor = chartCssVariables.tooltipBackground,
    children,
    className = "",
    container,
    containerHeight,
    containerWidth,
    entrance = true,
    flipped: flippedOverride,
    left: leftOverride,
    offset = 16,
    panelStyle,
    springConfig,
    top: topOverride,
    x,
    y,
}: Omit<TooltipBoxProperties, "containerRef" | "visible"> & {
    container: HTMLElement;
}) {
    const { tooltipBoxSpring } = useChartConfig();
    const effectiveSpring = springConfig ?? tooltipBoxSpring;

    const tooltipReference = useRef<HTMLDivElement>(null);
    const tooltipWidthReference = useRef(180);
    const tooltipHeightReference = useRef(80);
    const [staticPosition, setStaticPosition] = useState({ left: x, top: y });

    const tw = tooltipWidthReference.current;
    const th = tooltipHeightReference.current;
    const shouldFlipX = x + tw + offset > containerWidth;
    const targetX = shouldFlipX ? x - offset - tw : x + offset;
    const targetY = Math.max(
        offset,
        Math.min(y - th / 2, containerHeight - th - offset)
    );

    const animatedLeft = useSpring(targetX, effectiveSpring);
    const animatedTop = useSpring(targetY, effectiveSpring);

    if (animate && leftOverride === undefined) {
        animatedLeft.set(targetX);
    }
    if (animate && topOverride === undefined) {
        animatedTop.set(targetY);
    }

    useLayoutEffect(() => {
        if (!tooltipReference.current) {
            return;
        }
        const element = tooltipReference.current;
        const w = element.offsetWidth;
        const h = element.offsetHeight;
        if (w > 0) {
            tooltipWidthReference.current = w;
        }
        if (h > 0) {
            tooltipHeightReference.current = h;
        }
        const w2 = tooltipWidthReference.current;
        const h2 = tooltipHeightReference.current;
        const flip = x + w2 + offset > containerWidth;
        const tx = flip ? x - offset - w2 : x + offset;
        const ty = Math.max(
            offset,
            Math.min(y - h2 / 2, containerHeight - h2 - offset)
        );
        if (!animate) {
            setStaticPosition({ left: tx, top: ty });
            return;
        }
        if (leftOverride === undefined) {
            animatedLeft.set(tx);
        }
        if (topOverride === undefined) {
            animatedTop.set(ty);
        }
    }, [
        x,
        y,
        containerWidth,
        containerHeight,
        offset,
        leftOverride,
        topOverride,
        animate,
        animatedLeft,
        animatedTop,
    ]);

    const previousFlipReference = useRef(shouldFlipX);
    const [flipKey, setFlipKey] = useState(0);

    useEffect(() => {
        if (previousFlipReference.current !== shouldFlipX) {
            setFlipKey((k) => k + 1);
            previousFlipReference.current = shouldFlipX;
        }
    }, [shouldFlipX]);

    const finalLeft = animate
        ? (leftOverride ?? animatedLeft)
        : staticPosition.left;
    const finalTop = animate
        ? (topOverride ?? animatedTop)
        : staticPosition.top;
    const isFlipped = flippedOverride ?? shouldFlipX;
    const transformOrigin = isFlipped ? "right top" : "left top";

    const panelClassName = cn(
        "min-w-[140px] overflow-hidden rounded-lg text-chart-tooltip-foreground shadow-lg",
        panelStyle?.backgroundColor === undefined &&
            backgroundColor === chartCssVariables.tooltipBackground &&
            "bg-chart-tooltip-background",
        panelStyle?.backdropFilter === undefined && "backdrop-blur-md"
    );
    const panelStyleResolved = {
        transformOrigin,
        ...(panelStyle?.backgroundColor === undefined && {
            backgroundColor,
        }),
        ...panelStyle,
    };

    if (!entrance) {
        return createPortal(
            <div
                className={cn("pointer-events-none absolute z-50", className)}
                ref={tooltipReference}
                style={{ left: staticPosition.left, top: staticPosition.top }}
            >
                <div className={panelClassName} style={panelStyleResolved}>
                    {children}
                </div>
            </div>,
            container
        );
    }

    return createPortal(
        <motion.div
            animate={{ opacity: 1 }}
            className={cn("pointer-events-none absolute z-50", className)}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            ref={tooltipReference}
            style={{ left: finalLeft, top: finalTop }}
            transition={{ duration: 0.1 }}
        >
            <motion.div
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className={panelClassName}
                initial={{ opacity: 0, scale: 0.85, x: isFlipped ? 20 : -20 }}
                key={flipKey}
                style={panelStyleResolved}
                transition={{ damping: 25, stiffness: 300, type: "spring" }}
            >
                {children}
            </motion.div>
        </motion.div>,
        container
    );
}

TooltipBox.displayName = "TooltipBox";

export default TooltipBox;
