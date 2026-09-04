"use client";

import type { Variants } from "motion/react";

import { motion } from "motion/react";
import { memo } from "react";

import { DEFAULT_CHART_ENTER_TRANSITION } from "./animation";

export interface SeriesPointMarkerStyle {
    /** Initial blur in px during enter animation. Default: 2 */
    enterBlur?: number;
    /** Dim non-active points while hovering. Default: true */
    fadeOnHover?: boolean;
    /** Fill color for the inner circle */
    fill?: string;
    /**
     * Blur in px for non-hovered points when `fadeOnHover` is true.
     * Applied once on the dimmed layer (not per dot) for performance. Default: 2
     */
    inactiveBlur?: number;
    /** Opacity for non-hovered points when `fadeOnHover` is true. Default: 0.5 */
    inactiveOpacity?: number;
    /** Outer outline color. Default: same as `stroke` */
    outlineColor?: string;
    /** Optional outer outline beyond the ring. Default: 0 */
    outlineWidth?: number;
    /** Point radius in px. Default: 5 */
    radius?: number;
    /** Gap between the inner fill and outer ring in px. Default: 2 */
    ringGap?: number;
    /** Enlarge the active point while hovering. Default: true */
    showActiveHighlight?: boolean;
    /** Outer ring stroke color. Default: same as `fill` */
    stroke?: string;
    /** Outer ring stroke width in px. Default: 2. Set to 0 to disable. */
    strokeWidth?: number;
}

export interface StaticSeriesPointMarkerProperties extends SeriesPointMarkerStyle {
    cx: number;
    cy: number;
    scale?: number;
}

interface MarkerCirclesProperties {
    fill?: string;
    outlineColor?: string;
    outlineWidth: number;
    radius: number;
    ringGap: number;
    stroke?: string;
    strokeWidth: number;
}

function MarkerCircles({
    fill,
    outlineColor,
    outlineWidth,
    radius,
    ringGap,
    stroke,
    strokeWidth,
}: MarkerCirclesProperties) {
    const resolvedStroke = stroke ?? fill ?? "currentColor";
    const resolvedOutlineColor = outlineColor ?? resolvedStroke;
    const ringOuter = strokeWidth > 0 ? radius + ringGap + strokeWidth : radius;
    const outlineRadius = outlineWidth > 0 ? ringOuter + outlineWidth / 2 : 0;

    return (
        <>
            {outlineWidth > 0 ? (
                <circle
                    cx={0}
                    cy={0}
                    fill="none"
                    r={outlineRadius}
                    stroke={resolvedOutlineColor}
                    strokeWidth={outlineWidth}
                />
            ) : null}
            <circle cx={0} cy={0} fill={fill} r={radius} />
            {strokeWidth > 0 ? (
                <circle
                    cx={0}
                    cy={0}
                    fill="none"
                    r={radius + ringGap + strokeWidth / 2}
                    stroke={resolvedStroke}
                    strokeWidth={strokeWidth}
                />
            ) : null}
        </>
    );
}

export const StaticSeriesPointMarker = memo(function StaticSeriesPointMarker({
    cx,
    cy,
    fill,
    outlineColor,
    outlineWidth = 0,
    radius = 5,
    ringGap = 2,
    scale = 1,
    stroke,
    strokeWidth = 2,
}: StaticSeriesPointMarkerProperties) {
    return (
        <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
            <MarkerCircles
                fill={fill}
                outlineColor={outlineColor}
                outlineWidth={outlineWidth}
                radius={radius}
                ringGap={ringGap}
                stroke={stroke}
                strokeWidth={strokeWidth}
            />
        </g>
    );
});

export interface SeriesPointMarkerProperties extends SeriesPointMarkerStyle {
    cx: number;
    cy: number;
    dataKey: string;
    enterDuration: number;
    index: number;
    revealDelay: number;
    revealEpoch: number;
}

export function getSeriesMarkerVisualExtent(
    style: Pick<
        SeriesPointMarkerStyle,
        | "outlineWidth"
        | "radius"
        | "ringGap"
        | "showActiveHighlight"
        | "strokeWidth"
    >
): number {
    const radius = style.radius ?? 5;
    const strokeWidth = style.strokeWidth ?? 2;
    const ringGap = style.ringGap ?? 2;
    const outlineWidth = style.outlineWidth ?? 0;
    const showActiveHighlight = style.showActiveHighlight ?? true;
    const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
    const outline = Math.max(outlineWidth, 0);
    const highlightPad = showActiveHighlight ? radius * 0.35 : 0;
    return radius + ring + outline + highlightPad + 2;
}

/** Motion enter marker — used only while the chart reveal is running. */
export function SeriesPointMarker({
    cx,
    cy,
    dataKey,
    enterBlur = 2,
    enterDuration,
    fill,
    index,
    outlineColor,
    outlineWidth = 0,
    radius = 5,
    revealDelay,
    revealEpoch,
    ringGap = 2,
    stroke,
    strokeWidth = 2,
}: SeriesPointMarkerProperties) {
    const variants: Variants = {
        hidden: {
            filter: `blur(${enterBlur}px)`,
            opacity: 0,
            scale: 1,
        },
        visible: {
            filter: "blur(0px)",
            opacity: 1,
            scale: 1,
            transition: {
                delay: revealDelay,
                duration: enterDuration,
                ease: DEFAULT_CHART_ENTER_TRANSITION.ease,
            },
        },
    };

    return (
        <g transform={`translate(${cx}, ${cy})`}>
            <motion.g
                animate="visible"
                initial="hidden"
                key={`${dataKey}-${index}-${revealEpoch}`}
                variants={variants}
            >
                <MarkerCircles
                    fill={fill}
                    outlineColor={outlineColor}
                    outlineWidth={outlineWidth}
                    radius={radius}
                    ringGap={ringGap}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                />
            </motion.g>
        </g>
    );
}
