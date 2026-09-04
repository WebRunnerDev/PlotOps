import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import {
    computeSprintTimeline,
    type SprintTimeline,
} from "@/features/sprints/model/compute-sprint-timeline";
import { EASE_OUT } from "@/shared/lib/ease";
import { cn } from "@/shared/lib/utils";

type ActiveSprintLiveStripProperties = {
    sizeLabel: string;
    sprint: Sprint;
};

export function ActiveSprintLiveStrip({
    sizeLabel,
    sprint,
}: ActiveSprintLiveStripProperties) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();
    const timeline = computeSprintTimeline({
        endsOn: sprint.endsOn,
        startsOn: sprint.startsOn,
        today: todayIsoDate(),
    });

    return (
        <motion.aside
            animate={{ opacity: 1, y: 0 }}
            aria-label={t("sprints.activeLiveEyebrow")}
            className="relative overflow-hidden rounded-none border border-primary/40 bg-card/60 shadow-[inset_3px_0_0_0_var(--color-primary)]"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            transition={{ delay: 0.08, duration: 0.7, ease: EASE_OUT }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_55%)]"
            />
            <div className="relative grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-6 sm:px-5 sm:py-5">
                <div className="min-w-0 space-y-2">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.16em]">
                        {t("sprints.activeLiveEyebrow")}
                    </p>
                    <h2 className="min-w-0 truncate font-heading text-[clamp(1.5rem,1rem+1.8vw,2.25rem)] font-bold leading-[1.05] tracking-[-0.04em]">
                        {sprint.name}
                    </h2>
                    {sprint.goal ? (
                        <p className="max-w-xl text-ui text-muted-foreground text-pretty">
                            {sprint.goal}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
                        <span>{sizeLabel}</span>
                        {sprint.startsOn && sprint.endsOn ? (
                            <span className="font-mono normal-case tracking-normal">
                                {sprint.startsOn} → {sprint.endsOn}
                            </span>
                        ) : null}
                    </div>
                </div>

                <ActiveCountdown timeline={timeline} />
            </div>

            <ActiveProgressRail timeline={timeline} />
        </motion.aside>
    );
}

function ActiveCountdown({ timeline }: { timeline: SprintTimeline }) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();

    if (timeline.phase === "undated" || timeline.daysRemaining === null) {
        return (
            <div className="min-w-0 sm:text-right">
                <p className="text-meta text-muted-foreground">
                    {t("sprints.activeLiveUndated")}
                </p>
            </div>
        );
    }

    const label =
        timeline.phase === "overdue"
            ? t("sprints.activeLiveOverdue")
            : timeline.phase === "upcoming"
              ? t("sprints.activeLiveUpcoming")
              : t("sprints.pulseDaysLeft");

    return (
        <div className="flex min-w-0 items-end gap-3 sm:flex-col sm:items-end sm:gap-1">
            <p
                className={cn(
                    "font-heading text-[clamp(2.75rem,1.5rem+4vw,4.5rem)] font-bold leading-none tracking-tighter tabular-nums",
                    timeline.phase === "overdue"
                        ? "text-warning"
                        : "text-primary"
                )}
            >
                {reduceMotion ? (
                    timeline.daysRemaining
                ) : (
                    <NumberFlow
                        isolate
                        value={timeline.daysRemaining}
                        willChange
                    />
                )}
            </p>
            <p className="pb-1 text-meta text-muted-foreground">{label}</p>
        </div>
    );
}

function ActiveProgressRail({ timeline }: { timeline: SprintTimeline }) {
    const reduceMotion = useReducedMotion();
    const progress = timeline.progress01 ?? 0;

    return (
        <div
            aria-hidden
            className="relative h-1 w-full overflow-hidden bg-primary/15"
        >
            <motion.div
                animate={{ scaleX: progress }}
                className={cn(
                    "h-full origin-left",
                    timeline.phase === "overdue" ? "bg-warning" : "bg-primary"
                )}
                initial={reduceMotion ? false : { scaleX: 0 }}
                transition={{ delay: 0.2, duration: 1, ease: EASE_OUT }}
            />
        </div>
    );
}
