import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { CycleTime } from "@/features/flow-reports/model/build-cycle-time";

import {
    buildCumulativeFlow,
    flowRangeStart,
} from "@/features/flow-reports/model/build-cumulative-flow";
import { buildCycleTime } from "@/features/flow-reports/model/build-cycle-time";
import {
    FLOW_RANGE_DAYS,
    type FlowColumn,
    type FlowRangeDays,
} from "@/features/flow-reports/model/types";
import { useBoardFlowHistory } from "@/features/flow-reports/model/use-board-flow-history";
import { CumulativeFlowChart } from "@/features/flow-reports/ui/cumulative-flow-chart";
import { CycleTimeChart } from "@/features/flow-reports/ui/cycle-time-chart";
import {
    formatCycleDuration,
    formatShortDate,
} from "@/features/flow-reports/ui/flow-chart-parts";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { ButtonGroup } from "@/shared/shadcn/ui/button-group";
import { Skeleton } from "@/shared/shadcn/ui/skeleton";

/**
 * Flow reports of one Board for teams without Sprints: Cumulative flow
 * (where work piles up) and Cycle time (how long a Task takes from start to
 * Done), over the last 14 / 30 / 90 days.
 */
export function FlowReportsPanel({
    boardId,
    columns,
    onOpenTask,
}: {
    boardId: string;
    columns: FlowColumn[];
    onOpenTask: (taskId: string) => void;
}) {
    const { t } = useTranslation("board");
    const [rangeDays, setRangeDays] = useState<FlowRangeDays>(30);
    const { data, error, isPending, refetch } = useBoardFlowHistory(
        boardId,
        rangeDays
    );

    const report = useMemo(() => {
        if (!data) return null;
        const now = new Date();
        const since = flowRangeStart(now, rangeDays);
        return {
            cycle: buildCycleTime({ columns, history: data, now, since }),
            flow: buildCumulativeFlow({
                columns,
                history: data,
                now,
                rangeDays,
            }),
            now,
            since,
        };
    }, [columns, data, rangeDays]);

    return (
        <div className="flex min-w-0 flex-col gap-8">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-ui text-muted-foreground">
                    {t("flow.subtitle")}
                </p>
                <ButtonGroup aria-label={t("flow.rangeLabel")}>
                    {FLOW_RANGE_DAYS.map((days) => (
                        <Button
                            aria-pressed={rangeDays === days}
                            key={days}
                            onClick={() => setRangeDays(days)}
                            size="sm"
                            type="button"
                            variant={rangeDays === days ? "default" : "outline"}
                        >
                            {t("flow.rangeDays", { count: days })}
                        </Button>
                    ))}
                </ButtonGroup>
            </div>

            {error && !data ? (
                <div className="flex flex-col items-start gap-3">
                    <Alert variant="destructive">
                        <AlertDescription>
                            {t("flow.loadFailed")}
                        </AlertDescription>
                    </Alert>
                    <Button
                        onClick={() => void refetch()}
                        type="button"
                        variant="outline"
                    >
                        {t("sprints.retry")}
                    </Button>
                </div>
            ) : isPending || !report ? (
                <div aria-busy className="flex flex-col gap-8">
                    <Skeleton className="h-72 w-full" />
                    <Skeleton className="h-72 w-full" />
                </div>
            ) : (
                <>
                    <ReportSection
                        description={t("flow.cfdDescription")}
                        title={t("flow.cfdTitle")}
                    >
                        {report.flow.days.every((day) =>
                            day.counts.every((count) => count === 0)
                        ) ? (
                            <p className="text-ui text-muted-foreground">
                                {t("flow.cfdEmpty")}
                            </p>
                        ) : (
                            <CumulativeFlowChart flow={report.flow} />
                        )}
                    </ReportSection>

                    <ReportSection
                        description={t("flow.cycleDescription")}
                        title={t("flow.cycleTitle")}
                    >
                        <CycleTimeSummary cycle={report.cycle} />
                        {report.cycle.points.length === 0 ? (
                            <p className="text-ui text-muted-foreground">
                                {t("flow.cycleEmpty")}
                            </p>
                        ) : (
                            <>
                                <CycleTimeChart
                                    cycle={report.cycle}
                                    now={report.now}
                                    onOpenTask={onOpenTask}
                                    since={report.since}
                                />
                                <CycleTimeTable
                                    cycle={report.cycle}
                                    onOpenTask={onOpenTask}
                                />
                            </>
                        )}
                        {report.cycle.withoutHistory > 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {t("flow.withoutHistory", {
                                    count: report.cycle.withoutHistory,
                                })}
                            </p>
                        ) : null}
                    </ReportSection>
                </>
            )}
        </div>
    );
}

function CycleTimeSummary({ cycle }: { cycle: CycleTime }) {
    const { i18n, t } = useTranslation("board");
    const format = (ms: null | number) =>
        ms === null ? "—" : formatCycleDuration(ms, i18n.resolvedLanguage, t);

    return (
        <dl className="grid min-w-0 grid-cols-3 gap-px border border-border bg-border">
            <StatTile
                label={t("flow.statMedian")}
                value={format(cycle.medianMs)}
            />
            <StatTile label={t("flow.statP85")} value={format(cycle.p85Ms)} />
            <StatTile
                label={t("flow.statCompleted")}
                value={String(cycle.points.length)}
            />
        </dl>
    );
}

function CycleTimeTable({
    cycle,
    onOpenTask,
}: {
    cycle: CycleTime;
    onOpenTask: (taskId: string) => void;
}) {
    const { i18n, t } = useTranslation("board");
    const locale = i18n.resolvedLanguage;
    const rows = cycle.points.toSorted((a, b) => b.durationMs - a.durationMs);

    return (
        <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {t("flow.showTable")}
            </summary>
            <div className="mt-2 max-h-72 overflow-auto border border-border">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 border-b border-border bg-muted text-meta text-muted-foreground">
                        <tr>
                            <th className="px-3 py-1.5 font-normal" scope="col">
                                {t("flow.columnTask")}
                            </th>
                            <th
                                className="px-3 py-1.5 text-right font-normal"
                                scope="col"
                            >
                                {t("flow.cycleTitle")}
                            </th>
                            <th
                                className="px-3 py-1.5 text-right font-normal"
                                scope="col"
                            >
                                {t("flow.columnCompleted")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((point) => (
                            <tr key={point.task.id}>
                                <td className="max-w-0 px-3 py-1.5">
                                    <button
                                        className="block w-full truncate text-left hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        onClick={() =>
                                            onOpenTask(point.task.id)
                                        }
                                        type="button"
                                    >
                                        <span className="text-muted-foreground">
                                            {point.task.key}
                                        </span>{" "}
                                        {point.task.title}
                                    </button>
                                </td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                                    {formatCycleDuration(
                                        point.durationMs,
                                        locale,
                                        t
                                    )}
                                </td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-muted-foreground">
                                    {formatShortDate(point.completedAt, locale)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function ReportSection({
    children,
    description,
    title,
}: {
    children: ReactNode;
    description: string;
    title: string;
}) {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 className="text-h3">{title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
                    {description}
                </p>
            </div>
            {children}
        </section>
    );
}

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex min-w-0 flex-col gap-1 bg-card px-3 py-3 sm:px-4">
            <dt className="truncate text-sm text-muted-foreground">{label}</dt>
            <dd className="truncate text-h3 tabular-nums">{value}</dd>
        </div>
    );
}
