import { motion, useReducedMotion, type Variants } from "motion/react";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";

import { EASE_OUT } from "@/shared/lib/ease";
import { clearSsgAuthSessionMask } from "@/shared/lib/ssg-auth-session-mask";
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

/** Opacity + translate only — clip-path / filter on a full-viewport layer janks. */
const screenVariants: Variants = {
    exit: {
        opacity: 0,
        transition: { duration: 0.36, ease: EASE_OUT },
        y: "-6%",
    },
    hidden: {
        opacity: 0,
        y: "4%",
    },
    show: {
        opacity: 1,
        transition: { duration: 0.32, ease: EASE_OUT },
        y: "0%",
    },
};

/**
 * Full-viewport auth boot — brand-first signature while the session restores
 * (or boot fails). Keep motion on the compositor: opacity + transform only.
 */
export function BootScreen({ className, error }: BootScreenProperties) {
    const { t } = useTranslation("auth");
    const reduceMotion = useReducedMotion() === true;

    // Hand viewport from the static SSG mask to BootScreen in the same frame.
    useLayoutEffect(() => {
        clearSsgAuthSessionMask();
    }, []);

    const statusLabel = error ? null : t("boot.loading");

    return (
        <motion.div
            animate="show"
            aria-busy={!error}
            aria-live="polite"
            className={cn(
                // Flat boot surface — grid atmosphere is paint-heavy under motion.
                "relative flex min-h-dvh w-full min-w-0 flex-col items-center justify-center overflow-hidden bg-background px-6 py-16",
                className
            )}
            exit="exit"
            initial={reduceMotion ? false : "hidden"}
            role="status"
            style={{ transform: "translateZ(0)" }}
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
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    transition={{
                        delay: 0.04,
                        duration: 0.45,
                        ease: EASE_OUT,
                    }}
                >
                    {t("boot.eyebrow")}
                </motion.p>

                <BrandMark reduceMotion={reduceMotion} />

                <motion.div
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    className="flex w-full flex-col gap-4"
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    transition={{
                        delay: 0.36,
                        duration: 0.45,
                        ease: EASE_OUT,
                    }}
                >
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
                        <p className="font-mono text-meta text-muted-foreground normal-case tracking-[0.08em]">
                            {statusLabel}
                            <span
                                aria-hidden
                                className="ml-0.5 inline-block text-primary motion-safe:animate-pulse"
                            >
                                _
                            </span>
                        </p>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}

function BrandMark({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div className="relative">
            {/* Soft glow via gradient only — CSS filter blur is a paint trap on boot. */}
            <motion.div
                animate={reduceMotion ? { opacity: 0.55 } : { opacity: 0.7 }}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 size-[min(22rem,70vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_35%,transparent)_0%,transparent_70%)]"
                initial={reduceMotion ? false : { opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: EASE_OUT }}
            />

            <p
                aria-hidden
                className="relative font-heading text-[clamp(3.25rem,2rem+8vw,7rem)] font-bold leading-[0.9] tracking-tighter text-foreground"
            >
                {[...BRAND].map((char, index) => {
                    const riseDelay = 0.08 + index * 0.04;
                    return (
                        <span
                            className="inline-block overflow-hidden pb-[0.06em] align-bottom"
                            // biome-ignore lint/suspicious/noArrayIndexKey: stable brand string
                            key={`${char}-${index}`}
                        >
                            <motion.span
                                animate={{ y: "0%" }}
                                className="inline-block will-change-transform"
                                initial={reduceMotion ? false : { y: "110%" }}
                                transition={{
                                    delay: riseDelay,
                                    duration: 0.7,
                                    ease: EASE_OUT,
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

function CropMarks({ reduceMotion }: { reduceMotion: boolean }) {
    const arm = "absolute bg-primary/40";
    const length_ = "h-3 w-px sm:h-4";
    const wid = "h-px w-3 sm:w-4";

    return (
        <motion.div
            animate={{ opacity: 1 }}
            aria-hidden
            className="pointer-events-none absolute inset-5 sm:inset-8"
            initial={reduceMotion ? false : { opacity: 0 }}
            transition={{ delay: 0.12, duration: 0.5, ease: EASE_OUT }}
        >
            <span className={cn(arm, length_, "top-0 left-0")} />
            <span className={cn(arm, wid, "top-0 left-0")} />
            <span className={cn(arm, length_, "top-0 right-0")} />
            <span className={cn(arm, wid, "top-0 right-0")} />
            <span className={cn(arm, length_, "bottom-0 left-0")} />
            <span className={cn(arm, wid, "bottom-0 left-0")} />
            <span className={cn(arm, length_, "bottom-0 right-0")} />
            <span className={cn(arm, wid, "bottom-0 right-0")} />
        </motion.div>
    );
}
