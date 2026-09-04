"use client";

import { motion, useSpring, useTransform } from "motion/react";

import { type SpringConfig, useChartConfig } from "../chart-config-context";
import { chartCssVars as chartCssVariables } from "../chart-context";

export interface TooltipDotProperties {
    /** Animate position with a spring. Default: true */
    animate?: boolean;
    color: string;
    /**
     * Ring corner radius as a fraction of side length (0 = square, 0.5 = circle).
     * Same semantics as bar square radius.
     */
    cornerRadiusFraction?: number;
    /** Half of width/height for dots; half-extent for ring squares. Default: 5 */
    size?: number;
    /** Per-chart override; falls back to `ChartConfigProvider.tooltipSpring`. */
    springConfig?: SpringConfig;
    strokeColor?: string;
    strokeWidth?: number;
    /** Dot fill or transparent ring around the hovered mark. Default: "dot" */
    variant?: "dot" | "ring";
    visible: boolean;
    x: number;
    y: number;
}

export function TooltipDot({
    animate = true,
    color,
    cornerRadiusFraction = 0.25,
    size = 5,
    springConfig,
    strokeColor = chartCssVariables.background,
    strokeWidth = 2,
    variant = "dot",
    visible,
    x,
    y,
}: TooltipDotProperties) {
    const { tooltipSpring } = useChartConfig();
    const effectiveSpring = springConfig ?? tooltipSpring;
    const animatedX = useSpring(x, effectiveSpring);
    const animatedY = useSpring(y, effectiveSpring);

    const isRing = variant === "ring";
    const fill = isRing ? "transparent" : color;
    const stroke = isRing ? color : strokeColor;
    const effectiveStrokeWidth = isRing ? (strokeWidth ?? 1.5) : strokeWidth;

    if (animate && !isRing) {
        animatedX.set(x);
        animatedY.set(y);
    }

    if (!visible) {
        return null;
    }

    if (isRing) {
        if (animate) {
            return (
                <AnimatedRingDot
                    cornerRadiusFraction={cornerRadiusFraction}
                    fill={fill}
                    halfExtent={size}
                    springConfig={springConfig}
                    stroke={stroke}
                    strokeWidth={effectiveStrokeWidth}
                    x={x}
                    y={y}
                />
            );
        }

        const side = size * 2;
        const rx = ringCornerRadius(size, cornerRadiusFraction);

        return (
            <rect
                fill={fill}
                height={side}
                rx={rx}
                ry={rx}
                stroke={stroke}
                strokeWidth={effectiveStrokeWidth}
                width={side}
                x={x - size}
                y={y - size}
            />
        );
    }

    if (!animate) {
        return (
            <circle
                cx={x}
                cy={y}
                fill={fill}
                r={size}
                stroke={stroke}
                strokeWidth={effectiveStrokeWidth}
            />
        );
    }

    return (
        <motion.circle
            cx={animatedX}
            cy={animatedY}
            fill={fill}
            r={size}
            stroke={stroke}
            strokeWidth={effectiveStrokeWidth}
        />
    );
}

function AnimatedRingDot({
    cornerRadiusFraction,
    fill,
    halfExtent,
    springConfig,
    stroke,
    strokeWidth,
    x,
    y,
}: {
    cornerRadiusFraction: number;
    fill: string;
    halfExtent: number;
    springConfig?: SpringConfig;
    stroke: string;
    strokeWidth: number;
    x: number;
    y: number;
}) {
    const { tooltipSpring } = useChartConfig();
    const effectiveSpring = springConfig ?? tooltipSpring;
    const animatedX = useSpring(x, effectiveSpring);
    const animatedY = useSpring(y, effectiveSpring);
    const side = halfExtent * 2;
    const rx = ringCornerRadius(halfExtent, cornerRadiusFraction);
    const rectX = useTransform(animatedX, (value) => value - halfExtent);
    const rectY = useTransform(animatedY, (value) => value - halfExtent);

    animatedX.set(x);
    animatedY.set(y);

    return (
        <motion.rect
            fill={fill}
            height={side}
            rx={rx}
            ry={rx}
            stroke={stroke}
            strokeWidth={strokeWidth}
            width={side}
            x={rectX}
            y={rectY}
        />
    );
}

function ringCornerRadius(
    halfExtent: number,
    cornerRadiusFraction: number
): number {
    const side = halfExtent * 2;
    return side * Math.max(0, Math.min(0.5, cornerRadiusFraction));
}

TooltipDot.displayName = "TooltipDot";

export default TooltipDot;
