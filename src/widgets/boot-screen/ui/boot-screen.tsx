import {
    AnimatePresence,
    motion,
    useReducedMotion,
    type Variants,
} from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { EASE_OUT } from "@/shared/lib/ease";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

const BRAND = "PlotOps";

type BootScreenProperties = {
    className?: string;
    /** Error state — message + retry instead of loading status. */
    error?: {
        message: string;
        onRetry: () => void;
        retryLabel: string;
    };
};

const screenVariants: Variants = {
    exit: {
        clipPath: "inset(0 0 100% 0)",
        opacity: 0,
        transition: { duration: 0.52, ease: EASE_OUT },
    },
    hidden: {
        clipPath: "inset(0 0 0% 0)",
        opacity: 0,
    },
    show: {
        clipPath: "inset(0 0 0% 0)",
        opacity: 1,
        transition: { duration: 0.4, ease: EASE_OUT },
    },
};

function CropMarks({ reduceMotion }: { reduceMotion: boolean }) {
    const arm = "absolute bg-primary/40";
    const len = "h-3 w-px sm:h-4";
    const wid = "h-px w-3 sm:w-4";

    return (
        <motion.div
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
            aria-hidden
            className="pointer-events-none absolute inset-5 sm:inset-8"
            initial={reduceMotion ? false : { opacity: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: EASE_OUT }}
        >
            <span className={cn(arm, len, "top-0 left-0")} />
            <span className={cn(arm, wid, "top-0 left-0")} />
            <span className={cn(arm, len, "top-0 right-0")} />
            <span className={cn(arm, wid, "top-0 right-0")} />
            <span className={cn(arm, len, "bottom-0 left-0")} />
            <span className={cn(arm, wid, "bottom-0 left-0")} />
            <span className={cn(arm, len, "bottom-0 right-0")} />
            <span className={cn(arm, wid, "bottom-0 right-0")} />
        </motion.div>
    );
}

function BrandMark({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div className="relative">
            <motion.div
                animate={
                    reduceMotion
                        ? { opacity: 0.45 }
                        : {
                              opacity: [0, 0.75, 0.38],
                              scale: [0.72, 1.06, 1],
                          }
                }
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 size-[min(28rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.72 }}
                transition={{
                    delay: 0.28,
                    duration: 1.45,
                    ease: EASE_OUT,
                    times: [0, 0.42, 1],
                }}
            />

            <p
                aria-hidden
                className="relative font-heading text-[clamp(3.25rem,2rem+8vw,7rem)] font-bold leading-[0.9] tracking-tighter text-foreground"
            >
                {BRAND.split("").map((char, index) => {
                    const riseDelay = 0.1 + index * 0.052;
                    return (
                        <span
                            className="inline-block overflow-hidden pb-[0.06em] align-bottom"
                            // biome-ignore lint/suspicious/noArrayIndexKey: stable brand string
                            key={`${char}-${index}`}
                        >
                            <motion.span
                                animate={
                                    reduceMotion
                                        ? { y: "0%" }
                                        : {
                                              textShadow: [
                                                  "0 0 0 transparent",
                                                  "0 0 22px color-mix(in oklab, var(--primary) 50%, transparent)",
                                                  "0 0 0 transparent",
                                              ],
                                              y: "0%",
                                          }
                                }
                                className="inline-block will-change-transform"
                                initial={
                                    reduceMotion ? false : { y: "110%" }
                                }
                                transition={{
                                    delay: riseDelay,
                                    duration: 0.88,
                                    ease: EASE_OUT,
                                    textShadow: {
                                        delay: riseDelay + 0.62,
                                        duration: 0.7,
                                        ease: EASE_OUT,
                                    },
                                }}
                            >
                                {char}
                            </motion.span>
                        </span>
                    );
                })}
            </p>
        </div>
    );
}

function BootProgress({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div
            aria-hidden
            className="relative h-px w-full max-w-48 overflow-hidden bg-primary/20"
        >
            <motion.span
                animate={
                    reduceMotion ? { x: "80%" } : { x: ["-100%", "280%"] }
                }
                className="absolute inset-y-0 left-0 w-2/5 bg-primary"
                initial={false}
                transition={
                    reduceMotion
                        ? { duration: 0 }
                        : {
                              duration: 1.65,
                              ease: EASE_OUT,
                              repeat: Number.POSITIVE_INFINITY,
                              repeatDelay: 0.12,
                          }
                }
            />
        </div>
    );
}

function BootStatusLine({
    phases,
    reduceMotion,
}: {
    phases: string[];
    reduceMotion: boolean;
}) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    const safePhases = phases.length > 0 ? phases : ["…"];

    useEffect(() => {
        if (reduceMotion || safePhases.length < 2) return;

        const intervalId = window.setInterval(() => {
            setPhaseIndex((current) => (current + 1) % safePhases.length);
        }, 1400);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [reduceMotion, safePhases.length]);

    const label = safePhases[phaseIndex] ?? safePhases[0];

    return (
        <div className="relative min-h-[1.2em] overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.p
                    animate={{ opacity: 1, y: 0 }}
                    className="font-mono text-meta text-muted-foreground normal-case tracking-[0.08em]"
                    exit={
                        reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: -8 }
                    }
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    key={label}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                    {label}
                    <motion.span
                        animate={
                            reduceMotion
                                ? { opacity: 1 }
                                : { opacity: [1, 1, 0, 0] }
                        }
                        aria-hidden
                        className="text-primary"
                        transition={
                            reduceMotion
                                ? { duration: 0 }
                                : {
                                      duration: 1.05,
                                      ease: EASE_OUT,
                                      repeat: Number.POSITIVE_INFINITY,
                                      times: [0, 0.45, 0.5, 1],
                                  }
                        }
                    >
                        _
                    </motion.span>
                </motion.p>
            </AnimatePresence>
        </div>
    );
}

/**
 * Full-viewport auth boot — brand-first signature moment while the session
 * restores (or when boot fails). Clip-masked wordmark, bloom, crop marks,
 * and an exit morph into the app shell.
 */
export function BootScreen({ className, error }: BootScreenProperties) {
    const { t } = useTranslation("auth");
    const reduceMotion = useReducedMotion() === true;

    const phases = t("boot.loadingPhases", {
        returnObjects: true,
    });
    const loadingPhases = Array.isArray(phases)
        ? phases.filter((item): item is string => typeof item === "string")
        : [t("boot.loading")];

    return (
        <motion.div
            animate="show"
            aria-busy={!error}
            aria-live="polite"
            className={cn(
                "relative flex min-h-dvh w-full min-w-0 flex-col items-center justify-center overflow-hidden bg-auth-atmosphere px-6 py-16",
                className
            )}
            exit="exit"
            initial={reduceMotion ? false : "hidden"}
            role="status"
            variants={screenVariants}
        >
            <span className="sr-only">
                {error ? error.message : t("boot.loadingAria")}
            </span>

            <CropMarks reduceMotion={reduceMotion} />

            <div className="relative z-10 flex w-full max-w-lg flex-col items-start gap-6 sm:max-w-xl sm:gap-7 md:translate-x-[-4%]">
                <motion.p
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    className="font-mono text-meta text-primary uppercase tracking-[0.16em]"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    transition={{
                        delay: 0.04,
                        duration: 0.65,
                        ease: EASE_OUT,
                    }}
                >
                    {t("boot.eyebrow")}
                </motion.p>

                <BrandMark reduceMotion={reduceMotion} />

                <motion.div
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    className="flex w-full flex-col gap-4"
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    transition={{
                        delay: 0.48,
                        duration: 0.6,
                        ease: EASE_OUT,
                    }}
                >
                    {error ? null : (
                        <BootProgress reduceMotion={reduceMotion} />
                    )}

                    {error ? (
                        <div className="flex max-w-sm flex-col items-start gap-4">
                            <p className="text-ui text-muted-foreground">
                                {error.message}
                            </p>
                            <Button onClick={error.onRetry} type="button">
                                {error.retryLabel}
                            </Button>
                        </div>
                    ) : (
                        <BootStatusLine
                            phases={loadingPhases}
                            reduceMotion={reduceMotion}
                        />
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
