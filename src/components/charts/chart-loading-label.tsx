"use client";

import { motion } from "motion/react";

import { cn } from "@/shared/lib/utils";

import { ShimmeringText } from "../shimmering-text";
import {
    LINE_LOADING_PULSE_EASE,
    LOADING_LABEL_EXIT_S,
    LOADING_LABEL_EXIT_Y_PX,
} from "./line-loading-timing";

export interface ChartLoadingLabelProperties {
    className?: string;
    /** Animate down, fade, and blur during loading → ready handoff. */
    exiting?: boolean;
    /** Label shown centered over the chart. */
    text?: string;
}

export function ChartLoadingLabel({
    className,
    exiting = false,
    text = "Loading",
}: ChartLoadingLabelProperties) {
    if (!text.trim()) {
        return null;
    }

    return (
        <motion.div
            animate={{
                filter: exiting ? "blur(2px)" : "blur(0px)",
                opacity: exiting ? 0 : 1,
                y: exiting ? LOADING_LABEL_EXIT_Y_PX : 0,
            }}
            aria-live="polite"
            className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center",
                className
            )}
            initial={false}
            role="status"
            transition={{
                duration: LOADING_LABEL_EXIT_S,
                ease: [...LINE_LOADING_PULSE_EASE],
            }}
        >
            <ShimmeringText
                className="font-medium text-sm tracking-wide [--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]"
                text={text}
            />
        </motion.div>
    );
}

export default ChartLoadingLabel;
