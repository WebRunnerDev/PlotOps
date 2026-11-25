import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint, SprintEvent } from "@/features/sprints/model/types";
import type { Task } from "@/features/tasks";

import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import { buildSprintBurndownSeries } from "@/features/sprints/model/build-sprint-burndown-series";
import {
    buildSprintReportSummary,
    measureValue,
    type SprintReportMeasure,
    type SprintReportMetric,
} from "@/features/sprints/model/build-sprint-report-summary";
import { summarizeCarryoverByTaskId } from "@/features/sprints/model/carryover-targets";
import { formatSprintTimestamp } from "@/features/sprints/model/format-sprint-dates";
import { listSprintCompletionTasks } from "@/features/sprints/model/list-sprint-completion-tasks";
import {
    useSprintEvents,
    useSprintMutations,
} from "@/features/sprints/model/use-sprints";
import { SprintBurndownChart } from "@/features/sprints/ui/sprint-burndown-chart";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type SprintReportPanelProperties = {
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean }>;
    onOpenTask?: (taskId: string) => void;
    projectId: string;
    sprint: Sprint;
    /** All Board Tasks (members and former members). */
    tasks: Task[];
};

/**
 * Sprint report: completion stats, burndown, completed list and event log.
 * Active sprints read completion live from Done columns; Closed sprints use
 * the Close snapshot.
 */
export function SprintReportPanel({
    boardId,
    canManage,
    columns,
    onOpenTask,
    projectId,
    sprint,
    tasks,
}: SprintReportPanelProperties) {
    const { t } = useTranslation("board");
    const { data: events = [], isLoading } = useSprintEvents(sprint.id);
    const isCanceled = sprint.state === "canceled";

    const summary = useMemo(
        () =>
            buildSprintReportSummary({
                columns,
                events,
                sprint,
                tasks,
            }),
        [columns, events, sprint, tasks]
    );

    const carryoverSummary = useMemo(() => {
        const closed = events.find((event) => event.eventType === "closed");
        return summarizeCarryoverByTaskId(
            closed?.payload?.carryover_by_task_id
        );
    }, [events]);

    const burndownSeries = useMemo(() => {
        const doneColumnIds = new Set(
            columns.filter((column) => column.isDone).map((column) => column.id)
        );
        const closedOn = sprint.closedAt
            ? todayIsoDate(new Date(sprint.closedAt))
            : undefined;
        return buildSprintBurndownSeries({
            asOfDate:
                sprint.state === "closed"
                    ? (sprint.endsOn ?? closedOn ?? todayIsoDate())
                    : todayIsoDate(),
            closedOn,
            committedTaskIds: sprint.committedTaskIds,
            completedTaskIds: sprint.completedTaskIds,
            doneColumnIds,
            endsOn: sprint.endsOn,
            events,
            startsOn: sprint.startsOn,
            state: sprint.state,
            tasks: tasks.map((task) => ({
                estimate: task.estimate,
                id: task.id,
                status: task.status,
            })),
        });
    }, [columns, events, sprint, tasks]);

    return (
        <div className="flex min-w-0 flex-col gap-5 border-t border-border px-3 py-4 sm:px-4">
            {isCanceled ? (
                <p className="text-ui text-muted-foreground">
                    {t("sprints.canceledSummary")}
                </p>
            ) : (
                <SprintReportStats
                    carryover={carryoverSummary}
                    metric={summary.metric}
                    summary={summary}
                />
            )}

            {sprint.state === "closed" ? (
                <CompletedTaskList
                    boardId={boardId}
                    canManage={canManage}
                    onOpenTask={onOpenTask}
                    projectId={projectId}
                    sprint={sprint}
                    tasks={tasks}
                />
            ) : null}

            {sprint.state === "active" || sprint.state === "closed" ? (
                <SprintBurndownChart
                    mode={sprint.state === "active" ? "active" : "closed"}
                    series={burndownSeries}
                />
            ) : null}

            <SprintEventLog
                events={events}
                isLoading={isLoading}
                onOpenTask={onOpenTask}
                projectId={projectId}
                tasks={tasks}
            />
        </div>
    );
}

function CompletedTaskList({
    boardId,
    canManage,
    onOpenTask,
    projectId,
    sprint,
    tasks,
}: {
    boardId: string;
    canManage: boolean;
    onOpenTask?: (taskId: string) => void;
    projectId: string;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { t } = useTranslation("board");
    const { moveTasks } = useSprintMutations(projectId, boardId);
    const rows = useMemo(
        () =>
            listSprintCompletionTasks({
                completedTaskIds: sprint.completedTaskIds,
                sprintId: sprint.id,
                tasks,
            }),
        [sprint.completedTaskIds, sprint.id, tasks]
    );

    if (rows.length === 0) return null;

    const returnCompletedToSprint = (
        taskId: string,
        sprintPosition: null | number
    ) => {
        void moveTasks
            .mutateAsync([{ sprintId: sprint.id, sprintPosition, taskId }])
            .catch(() => {
                toast.error(t("sprints.reportMoveToBacklogUndoFailed"));
            });
    };

    const moveCompletedToBacklog = (taskId: string) => {
        const previousPosition =
            tasks.find((task) => task.id === taskId)?.sprintPosition ?? null;

        void moveTasks
            .mutateAsync([{ sprintId: null, sprintPosition: null, taskId }])
            .then(() => {
                toast.success(t("sprints.reportMoveToBacklogDone"), {
                    action: {
                        label: t("sprints.reportMoveToBacklogUndo"),
                        onClick: () => {
                            returnCompletedToSprint(taskId, previousPosition);
                        },
                    },
                });
            })
            .catch(() => {
                toast.error(t("sprints.reportMoveToBacklogFailed"));
            });
    };

    return (
        <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-ui font-medium">
                {t("sprints.reportCompletedList")}
                <span className="ml-2 text-meta text-muted-foreground">
                    {rows.length}
                </span>
            </h3>
            <ul className="scrollbar-board max-h-72 divide-y divide-border overflow-y-auto overscroll-contain border border-border">
                {rows.map((row) => (
                    <li
                        className="flex min-w-0 items-center gap-2 px-3 py-1.5"
                        key={row.id}
                    >
                        <span className="min-w-0 flex-1 truncate text-ui">
                            {row.key ? (
                                <TaskReference
                                    onOpenTask={onOpenTask}
                                    taskId={row.id}
                                    taskKey={row.key}
                                    title={row.title}
                                />
                            ) : (
                                <span className="text-muted-foreground">
                                    {t("sprints.reportTaskUnavailable")}
                                </span>
                            )}
                            {row.key && !row.stillMember ? (
                                <span className="ml-2 text-meta text-muted-foreground">
                                    {t(
                                        row.inBacklog
                                            ? "sprints.reportCompletedInBacklog"
                                            : "sprints.reportCompletedMoved"
                                    )}
                                </span>
                            ) : null}
                        </span>
                        {canManage && row.stillMember ? (
                            <Button
                                className="shrink-0"
                                disabled={moveTasks.isPending}
                                onClick={() => {
                                    moveCompletedToBacklog(row.id);
                                }}
                                size="xs"
                                type="button"
                                variant="ghost"
                            >
                                {t("sprints.reportMoveToBacklog")}
                            </Button>
                        ) : null}
                        {canManage && row.inBacklog ? (
                            <Button
                                className="shrink-0"
                                disabled={moveTasks.isPending}
                                onClick={() => {
                                    returnCompletedToSprint(row.id, null);
                                }}
                                size="xs"
                                type="button"
                                variant="ghost"
                            >
                                {t("sprints.reportReturnToSprint")}
                            </Button>
                        ) : null}
                    </li>
                ))}
            </ul>
        </section>
    );
}

function formatMeasure(
    t: (key: string, options?: Record<string, unknown>) => string,
    value: SprintReportMeasure,
    metric: SprintReportMetric
): string {
    return metric === "points"
        ? t("sprints.reportPointsValue", { count: value.points })
        : t("sprints.reportTasksValue", { count: value.count });
}

function ReportStat({
    label,
    secondary,
    value,
}: {
    label: string;
    secondary?: string;
    value: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 bg-background/90 px-3 py-2.5">
            <dt className="truncate text-meta text-muted-foreground">
                {label}
            </dt>
            <dd className="font-heading text-h3 tabular-nums tracking-tight">
                {value}
            </dd>
            {secondary ? (
                <dd className="text-meta text-muted-foreground">{secondary}</dd>
            ) : null}
        </div>
    );
}

function SprintEventLog({
    events,
    isLoading,
    onOpenTask,
    projectId,
    tasks,
}: {
    events: SprintEvent[];
    isLoading: boolean;
    onOpenTask?: (taskId: string) => void;
    projectId: string;
    tasks: Task[];
}) {
    const { i18n, t } = useTranslation("board");
    const people = useProjectPeople(projectId);
    const tasksById = useMemo(
        () => new Map(tasks.map((task) => [task.id, task])),
        [tasks]
    );
    const peopleById = useMemo(
        () => new Map(people.map((person) => [person.id, person.name])),
        [people]
    );
    const ordered = useMemo(
        () =>
            events.toSorted((left, right) =>
                right.createdAt.localeCompare(left.createdAt)
            ),
        [events]
    );

    return (
        <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-ui font-medium">
                {t("sprints.reportActivity")}
            </h3>
            {isLoading ? <Spinner className="size-4" /> : null}
            {!isLoading && ordered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t("sprints.reportActivityEmpty")}
                </p>
            ) : null}
            {ordered.length > 0 ? (
                <ol className="scrollbar-board max-h-72 divide-y divide-border overflow-y-auto overscroll-contain border border-border">
                    {ordered.map((event) => {
                        const task = event.taskId
                            ? tasksById.get(event.taskId)
                            : undefined;
                        const actor = event.actorId
                            ? peopleById.get(event.actorId)
                            : undefined;
                        return (
                            <li
                                className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-1.5 text-ui"
                                key={event.id}
                            >
                                <span
                                    className={cn(
                                        "shrink-0 text-meta",
                                        event.eventType === "task_added" &&
                                            "text-primary",
                                        event.eventType === "task_removed" &&
                                            "text-warning",
                                        event.eventType !== "task_added" &&
                                            event.eventType !==
                                                "task_removed" &&
                                            "text-muted-foreground"
                                    )}
                                >
                                    {t(`sprints.event.${event.eventType}`)}
                                </span>
                                {event.taskId ? (
                                    <span className="min-w-0 flex-1 truncate">
                                        {task ? (
                                            <TaskReference
                                                onOpenTask={onOpenTask}
                                                taskId={task.id}
                                                taskKey={task.key}
                                                title={task.title}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground">
                                                {t(
                                                    "sprints.reportTaskUnavailable"
                                                )}
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    <span className="flex-1" />
                                )}
                                <span className="shrink-0 text-meta text-muted-foreground">
                                    {actor ? `${actor} · ` : ""}
                                    {formatSprintTimestamp(
                                        event.createdAt,
                                        i18n.resolvedLanguage
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
        </section>
    );
}

function SprintReportStats({
    carryover,
    metric,
    summary,
}: {
    carryover: null | { backlogCount: number; draftCount: number };
    metric: SprintReportMetric;
    summary: ReturnType<typeof buildSprintReportSummary>;
}) {
    const { t } = useTranslation("board");
    const percent =
        summary.completion === null
            ? null
            : Math.round(summary.completion * 100);
    const doneValue = measureValue(summary.done, metric);
    const scopeValue = measureValue(summary.scope, metric);

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-ui">
                        <span className="font-heading text-h3 tabular-nums">
                            {percent === null ? "—" : `${percent}%`}
                        </span>{" "}
                        <span className="text-muted-foreground">
                            {t(
                                summary.doneIsLive
                                    ? "sprints.reportDoneOfScopeLive"
                                    : "sprints.reportDoneOfScope",
                                {
                                    done: doneValue,
                                    scope: scopeValue,
                                    unit: t(
                                        metric === "points"
                                            ? "sprints.unitPoints"
                                            : "sprints.unitTasks"
                                    ),
                                }
                            )}
                        </span>
                    </p>
                    {summary.doneIsLive ? (
                        <p className="text-sm text-muted-foreground">
                            {t("sprints.reportLiveHint")}
                        </p>
                    ) : null}
                </div>
                <div
                    aria-hidden
                    className="h-1.5 w-full overflow-hidden bg-primary/15"
                >
                    <div
                        className="h-full bg-primary transition-[width] duration-500 ease-(--ease-out-expo)"
                        style={{ width: `${percent ?? 0}%` }}
                    />
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
                <ReportStat
                    label={t(
                        summary.doneIsLive
                            ? "sprints.reportStatDoneLive"
                            : "sprints.reportStatDone"
                    )}
                    secondary={
                        metric === "points"
                            ? t("sprints.reportTasksValue", {
                                  count: summary.done.count,
                              })
                            : undefined
                    }
                    value={formatMeasure(t, summary.done, metric)}
                />
                <ReportStat
                    label={t(
                        summary.doneIsLive
                            ? "sprints.reportStatRemaining"
                            : "sprints.reportStatNotDone"
                    )}
                    secondary={
                        metric === "points"
                            ? t("sprints.reportTasksValue", {
                                  count: summary.remaining.count,
                              })
                            : undefined
                    }
                    value={formatMeasure(t, summary.remaining, metric)}
                />
                <ReportStat
                    label={t("sprints.reportStatCommitted")}
                    secondary={
                        metric === "points"
                            ? t("sprints.reportTasksValue", {
                                  count: summary.committed.count,
                              })
                            : undefined
                    }
                    value={formatMeasure(t, summary.committed, metric)}
                />
                <ReportStat
                    label={t("sprints.reportStatScopeChanges")}
                    secondary={
                        carryover
                            ? t("sprints.reportCarryover", {
                                  backlog: carryover.backlogCount,
                                  drafts: carryover.draftCount,
                              })
                            : undefined
                    }
                    value={`+${summary.scopeAdded} / −${summary.scopeRemoved}`}
                />
            </dl>
        </div>
    );
}

function TaskReference({
    onOpenTask,
    taskId,
    taskKey,
    title,
}: {
    onOpenTask?: (taskId: string) => void;
    taskId: string;
    taskKey: string;
    title?: string;
}) {
    const content = (
        <>
            <span className="font-mono text-code text-muted-foreground">
                {taskKey}
            </span>
            {title ? <span className="ml-2">{title}</span> : null}
        </>
    );
    if (!onOpenTask) return content;
    return (
        <button
            className="min-w-0 truncate text-left hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
                onOpenTask(taskId);
            }}
            type="button"
        >
            {content}
        </button>
    );
}
