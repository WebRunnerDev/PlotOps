import type { ReactNode } from "react";

import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import {
    measureValue,
    type SprintReportSummary,
} from "@/features/sprints/model/build-sprint-report-summary";
import {
    computeSprintTimeline,
    type SprintTimeline,
} from "@/features/sprints/model/compute-sprint-timeline";
import { EASE_OUT } from "@/shared/lib/ease";
import { cn } from "@/shared/lib/utils";

type ActiveSprintLiveStripProperties = {
    actions?: ReactNode;
    dateRange?: null | string;
    headingId: string;
    /** Extra inline items after the size label (e.g. unestimated chip). */
    meta?: ReactNode;
    /** Live work progress; omitted while it cannot be computed. */
    progress?: SprintReportSummary;
    sizeLabel: string;
    sprint: Sprint;
};

export function ActiveSprintLiveStrip({
    actions,
    dateRange,
    headingId,
    meta,
    progress,
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
        <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            transition={{ delay: 0.05, duration: 0.5, ease: EASE_OUT }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%)]"
            />
            <div className="relative grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:px-5">
                <div className="min-w-0 space-y-1.5">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.16em]">
                        {t("sprints.activeLiveEyebrow")}
                    </p>
                    <h2
                        className="min-w-0 truncate font-heading text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-bold leading-tight tracking-[-0.03em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        id={headingId}
                        tabIndex={-1}
                    >
                        {sprint.name}
                    </h2>
                    {sprint.goal ? (
                        <p className="max-w-xl text-ui text-muted-foreground text-pretty">
                            {sprint.goal}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
                        <span>{sizeLabel}</span>
                        {dateRange ? (
                            <span className="normal-case tracking-normal">
                                {dateRange}
                            </span>
                        ) : null}
                        {meta}
                    </div>
                </div>

                <ActiveCountdown timeline={timeline} />
            </div>

            {progress ? (
                <WorkProgress progress={progress} timeline={timeline} />
            ) : null}

            {actions ? (
                <div className="relative flex flex-wrap items-center gap-2 border-t border-primary/20 px-4 py-2.5 sm:px-5">
                    {actions}
                </div>
            ) : null}
        </motion.div>
    );
}

function ActiveCountdown({ timeline }: { timeline: SprintTimeline }) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();

    if (timeline.phase === "undated" || timeline.daysRemaining === null) {
        return (
            <div className="min-w-0 sm:text-right">
                <p className="text-sm text-muted-foreground">
                    {t("sprints.activeLiveUndated")}
                </p>
            </div>
        );
    }

    const isOverdue = timeline.phase === "overdue";
    const value = isOverdue
        ? (timeline.daysOverdue ?? 0)
        : timeline.daysRemaining;
    const label = isOverdue
        ? t("sprints.activeLiveOverdue", { count: value })
        : timeline.phase === "upcoming"
          ? t("sprints.activeLiveUpcoming")
          : t("sprints.pulseDaysLeft");

    return (
        <div className="flex min-w-0 items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0.5">
            <p
                className={cn(
                    "font-heading text-[clamp(1.75rem,1.25rem+1.5vw,2.5rem)] font-bold leading-none tracking-tight tabular-nums",
                    isOverdue ? "text-warning" : "text-primary"
                )}
            >
                {reduceMotion ? (
                    value
                ) : (
                    <NumberFlow isolate value={value} willChange />
                )}
            </p>
            <p className="text-meta text-muted-foreground">{label}</p>
        </div>
    );
}

/**
 * Work done (live Done-column reading) as a bar, with a tick where the
 * calendar is — work behind the tick means the sprint is behind schedule.
 */
function WorkProgress({
    progress,
    timeline,
}: {
    progress: SprintReportSummary;
    timeline: SprintTimeline;
}) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();
    const workPercent = Math.round((progress.completion ?? 0) * 100);
    const timePercent =
        timeline.progress01 === null
            ? null
            : Math.round(timeline.progress01 * 100);
    const behind =
        timePercent !== null &&
        (timeline.phase === "overdue" || timePercent - workPercent >= 20);
    const unit = t(
        progress.metric === "points"
            ? "sprints.unitPoints"
            : "sprints.unitTasks"
    );

    return (
        <div className="relative flex flex-col gap-1.5 px-4 pb-3 sm:px-5">
            <div
                aria-label={t("sprintsPage.workDone")}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={workPercent}
                className="relative h-2 w-full overflow-hidden bg-primary/15"
                role="progressbar"
            >
                <motion.div
                    animate={{ scaleX: workPercent / 100 }}
                    className={cn(
                        "h-full origin-left",
                        behind ? "bg-warning" : "bg-primary"
                    )}
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    transition={{ delay: 0.15, duration: 0.8, ease: EASE_OUT }}
                />
                {timePercent === null ? null : (
                    <div
                        aria-hidden
                        className="absolute inset-y-0 w-0.5 bg-foreground/70"
                        style={{ left: `calc(${timePercent}% - 1px)` }}
                    />
                )}
            </div>
            <p className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                <span>
                    <span className="text-foreground tabular-nums">
                        {workPercent}%
                    </span>{" "}
                    {t("sprints.liveProgressDone", {
                        done: measureValue(progress.done, progress.metric),
                        scope: measureValue(progress.scope, progress.metric),
                        unit,
                    })}
                </span>
                {timePercent === null ? null : (
                    <span>
                        {t("sprints.liveProgressTime", {
                            percent: timePercent,
                        })}
                    </span>
                )}
            </p>
        </div>
    );
}
