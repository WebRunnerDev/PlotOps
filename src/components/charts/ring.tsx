"use client";

import { arc as arcGenerator } from "@visx/shape";
import { motion, type MotionValue, useTransform } from "motion/react";
import { memo, useCallback } from "react";

import {
    ringCssVars as ringCssVariables,
    useRingHover,
    useRingStable,
} from "./ring-context";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";

export type RingLineCap = "butt" | "round";

export interface RingProperties {
    animate?: boolean;
    color?: string;
    index: number;
    lineCap?: RingLineCap;
    showGlow?: boolean;
}

function generateArcPath(
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    cornerRadius: number
): string {
    const generator = arcGenerator<unknown>({
        cornerRadius,
        innerRadius,
        outerRadius,
    });
    return generator({ endAngle, startAngle } as unknown as null) || "";
}

function ringHoverScale(isHovered: boolean, isPushedOut: boolean): number {
    if (isHovered) {
        return 1.03;
    }
    if (isPushedOut) {
        return 1.02;
    }
    return 1;
}

function RingProgressPath({
    animatedProgressPath,
    color,
    progressComplete,
    progressPath,
}: {
    animatedProgressPath: MotionValue<string>;
    color: string;
    progressComplete: boolean;
    progressPath: string;
}) {
    if (progressComplete) {
        if (!progressPath) {
            return null;
        }
        return <path d={progressPath} fill={color} />;
    }
    return <motion.path d={animatedProgressPath} fill={color} />;
}

export const Ring = memo(function Ring({
    animate = true,
    color: colorProperty,
    index,
    lineCap = "round",
    showGlow = true,
}: RingProperties) {
    const {
        animationKey,
        data,
        endAngle,
        enterStaggerScale,
        enterTransition,
        getColor,
        getRingRadii,
        startAngle,
    } = useRingStable();
    const { hoveredIndex, setHoveredIndex } = useRingHover();

    const expandDelay = index * 0.08 * enterStaggerScale;
    const expandProgress = useMountProgress(
        enterTransition,
        expandDelay,
        `${animationKey}-expand-${index}`
    );
    const expandComplete = useEnterComplete(expandProgress);

    const progressDelay = (0.6 + index * 0.1) * enterStaggerScale;
    const progressMount = useMountProgress(
        enterTransition,
        progressDelay,
        `${animationKey}-progress-${index}`
    );
    const progressComplete = useEnterComplete(progressMount);

    const ringData = data[index];
    const progress = ringData ? ringData.value / ringData.maxValue : 0;
    const arcRange = endAngle - startAngle;

    const animatedProgressPath = useTransform(progressMount, (v) => {
        if (!ringData) {
            return "";
        }
        const currentEndAngle = startAngle + arcRange * progress * v;
        if (currentEndAngle <= startAngle + 0.01) {
            return "";
        }
        const radii = getRingRadii(index);
        const corner =
            lineCap === "round"
                ? (radii.outerRadius - radii.innerRadius) / 2
                : 0;
        return generateArcPath(
            radii.innerRadius,
            radii.outerRadius,
            startAngle,
            currentEndAngle,
            corner
        );
    });

    const enterScale = useTransform(expandProgress, [0, 1], [0, 1]);

    const handleMouseEnter = useCallback(
        () => setHoveredIndex(index),
        [index, setHoveredIndex]
    );
    const handleMouseLeave = useCallback(
        () => setHoveredIndex(null),
        [setHoveredIndex]
    );

    if (!ringData) {
        return null;
    }

    const { innerRadius, outerRadius } = getRingRadii(index);
    const color = colorProperty || getColor(index);

    const isHovered = hoveredIndex === index;
    const isFaded = hoveredIndex !== null && hoveredIndex !== index;
    const isPushedOut = hoveredIndex !== null && hoveredIndex < index;

    const cornerRadius =
        lineCap === "round" ? (outerRadius - innerRadius) / 2 : 0;
    const bgPath = generateArcPath(
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        cornerRadius
    );
    const progressEndAngle = startAngle + arcRange * progress;
    const progressPath =
        progressEndAngle <= startAngle + 0.01
            ? ""
            : generateArcPath(
                  innerRadius,
                  outerRadius,
                  startAngle,
                  progressEndAngle,
                  cornerRadius
              );

    const hoverScale = ringHoverScale(isHovered, isPushedOut);
    const layerOpacity = isFaded ? 0.35 : 1;
    const enterDone = !animate || (expandComplete && progressComplete);

    const groupStyle = {
        cursor: "pointer" as const,
        filter:
            showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
        transformOrigin: "0px 0px",
    };

    if (enterDone) {
        return (
            <motion.g
                animate={{ opacity: layerOpacity, scale: hoverScale }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={groupStyle}
                transition={{
                    opacity: { duration: 0.15 },
                    scale: { damping: 25, stiffness: 400, type: "spring" },
                }}
            >
                <path d={bgPath} fill={ringCssVariables.ringBackground} />
                {progressPath ? <path d={progressPath} fill={color} /> : null}
            </motion.g>
        );
    }

    if (!expandComplete) {
        return (
            <motion.g
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{
                    ...groupStyle,
                    opacity: layerOpacity,
                    scale: enterScale,
                }}
            >
                <path d={bgPath} fill={ringCssVariables.ringBackground} />
            </motion.g>
        );
    }

    return (
        <motion.g
            animate={{ opacity: layerOpacity, scale: hoverScale }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={groupStyle}
            transition={{
                opacity: { duration: 0.15 },
                scale: { damping: 25, stiffness: 400, type: "spring" },
            }}
        >
            <path d={bgPath} fill={ringCssVariables.ringBackground} />
            <RingProgressPath
                animatedProgressPath={animatedProgressPath}
                color={color}
                progressComplete={progressComplete}
                progressPath={progressPath}
            />
        </motion.g>
    );
});

Ring.displayName = "Ring";

export default Ring;
