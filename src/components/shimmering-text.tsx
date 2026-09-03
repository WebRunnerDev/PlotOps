"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { type ComponentProps, useCallback } from "react";

import { cn } from "@/shared/lib/utils";

export type ShimmeringTextProps = Omit<
    ComponentProps<typeof motion.span>,
    "children"
> & {
    /**
     * Duration in seconds for one shimmer cycle.
     * @defaultValue 1
     */
    duration?: number;
    /**
     * Legacy alias for `paused`.
     * @defaultValue false
     */
    isStopped?: boolean;
    /**
     * Pause the shimmer (e.g. when the hero leaves the viewport).
     * @defaultValue false
     */
    paused?: boolean;
    /** The text to render with the shimmering effect. */
    text: string;
};

export function ShimmeringText({
    className,
    duration = 1,
    isStopped = false,
    paused = false,
    text,
    ...properties
}: ShimmeringTextProps) {
    const reducedMotion = useReducedMotion();
    const stopped = isStopped || paused || reducedMotion === true;

    const createCharVariants = useCallback(
        (charIndex: number): Variants => ({
            running: {
                color: [
                    "var(--color)",
                    "var(--shimmering-color)",
                    "var(--color)",
                ],
                transition: {
                    delay: (charIndex * duration) / text.length,
                    duration,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: text.length * 0.05,
                    repeatType: "loop",
                },
            },
            stopped: {
                color: "var(--color)",
                transition: {
                    duration: duration * 0.5,
                    ease: "easeOut",
                },
            },
        }),
        [duration, text.length]
    );

    return (
        <motion.span
            className={cn(
                "inline-flex select-none items-center leading-none",
                "[--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]",
                className
            )}
            {...properties}
        >
            {text.split("").map((char, index) => (
                <motion.span
                    animate={stopped ? "stopped" : "running"}
                    aria-hidden
                    className="inline-block whitespace-pre leading-none"
                    initial="stopped"
                    // biome-ignore lint/suspicious/noArrayIndexKey: static label text, order never changes
                    key={index}
                    variants={createCharVariants(index)}
                >
                    {char}
                </motion.span>
            ))}
            <span className="sr-only">{text}</span>
        </motion.span>
    );
}
