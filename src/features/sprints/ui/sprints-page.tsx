import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SprintsPageView } from "@/features/sprints/model/sprints-page-search";
import type { Sprint } from "@/features/sprints/model/types";
import type { Task } from "@/features/tasks";

import { useAuth } from "@/features/auth/model/use-auth";
import {
    BoardSwitcher,
    toBoardSettingsRepositories,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { FlowReportsPanel } from "@/features/flow-reports";
import { projectHasGithubRepo } from "@/features/projects/model/project-github-gate";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import {
    buildSprintHistoryRows,
    type SprintHistoryMetric,
} from "@/features/sprints/model/build-sprint-history-rows";
import {
    buildSprintReportSummary,
    measureValue,
} from "@/features/sprints/model/build-sprint-report-summary";
import { computeSprintTimeline } from "@/features/sprints/model/compute-sprint-timeline";
import { formatSprintDateRange } from "@/features/sprints/model/format-sprint-dates";
import {
    useBoardSprints,
    useSprintEvents,
} from "@/features/sprints/model/use-sprints";
import { SprintInsightsPanel } from "@/features/sprints/ui/sprint-insights-panel";
import { CloseSprintDialog } from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import { SprintStateBadge } from "@/features/sprints/ui/sprint-state-badge";
import {
    TaskDrawer,
    useBoardTasks,
    useTasksUiStore,
    withoutEpics,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button, buttonVariants } from "@/shared/shadcn/ui/button";
import { Skeleton } from "@/shared/shadcn/ui/skeleton";

type SprintsPageProperties = {
    boardId: string;
    projectId: string;
    view?: SprintsPageView;
};

/**
 * Sprints page: health of Active sprints, Velocity and the history of
 * Closed / Canceled sprints, each linking to its own Sprint report.
 * Planning (Drafts, Backlog) stays on the Backlog page. The Flow tab holds
 * the Board's flow reports (Cumulative flow, Cycle time) for teams that
 * work without Sprints.
 */
export function SprintsPage({
    boardId,
    projectId,
    view = "sprints",
}: SprintsPageProperties) {
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { canManageBoard, isSettled } = useProjectAccess(projectId);
    const canManage = isSettled && canManageBoard;
    const { data: project } = useProject(projectId);
    const { data: boards, isPending: boardsLoading } =
        useProjectBoards(projectId);
    const columnsApi = useBoardColumns(projectId, boardId);
    const tasksApi = useBoardTasks(projectId, boardId);
    const {
        data: sprintsData,
        error: sprintsQueryError,
        isLoading: sprintsLoading,
        refetch: refetchSprints,
    } = useBoardSprints(boardId);
    const sprints = useMemo(() => sprintsData ?? [], [sprintsData]);
    const tasks = useMemo(() => withoutEpics(tasksApi.tasks), [tasksApi.tasks]);
    const { columns } = columnsApi;

    const actives = useMemo(
        () => sprints.filter((sprint) => sprint.state === "active"),
        [sprints]
    );
    const drafts = useMemo(
        () => sprints.filter((sprint) => sprint.state === "draft"),
        [sprints]
    );
    const history = useMemo(
        () => buildSprintHistoryRows({ sprints, tasks }),
        [sprints, tasks]
    );

    const selectTask = useTasksUiStore((state) => state.selectTask);

    const header = (
        <SprintsPageHeader
            boardId={boardId}
            canManage={canManage}
            project={project}
            projectId={projectId}
            subtitle={view === "flow" ? undefined : t("sprintsPage.subtitle")}
            title={t(view === "flow" ? "flow.title" : "sprintsPage.title")}
        >
            <SprintsPageTabs
                boardId={boardId}
                projectId={projectId}
                view={view}
            />
        </SprintsPageHeader>
    );

    const drawer = (
        <TaskDrawer
            boardId={boardId}
            githubToken={githubAccessToken}
            projectId={projectId}
            repositories={project?.repositories ?? []}
        />
    );

    if (view === "flow") {
        return (
            <SprintsPageFrame>
                {header}
                {columnsApi.isLoading ? (
                    <div aria-busy className="flex flex-col gap-8">
                        <Skeleton className="h-72 w-full" />
                        <Skeleton className="h-72 w-full" />
                    </div>
                ) : (
                    <FlowReportsPanel
                        boardId={boardId}
                        columns={columns}
                        onOpenTask={selectTask}
                    />
                )}
                {drawer}
            </SprintsPageFrame>
        );
    }

    if (Boolean(sprintsQueryError) && sprintsData === undefined) {
        return (
            <SprintsPageFrame>
                {header}
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("sprints.loadFailed")}
                    </AlertDescription>
                </Alert>
                <Button
                    className="self-start"
                    onClick={() => void refetchSprints()}
                    type="button"
                    variant="outline"
                >
                    {t("sprints.retry")}
                </Button>
            </SprintsPageFrame>
        );
    }

    if (
        !boardsLoading &&
        !(boards ?? []).some((board) => board.id === boardId)
    ) {
        return (
            <SprintsPageFrame>
                <Alert variant="destructive">
                    <AlertDescription>{t("boardNotFound")}</AlertDescription>
                </Alert>
            </SprintsPageFrame>
        );
    }

    const loading =
        sprintsLoading || columnsApi.isLoading || tasksApi.isLoading;

    return (
        <SprintsPageFrame>
            {header}
            {loading ? (
                <div aria-busy className="flex flex-col gap-8">
                    <Skeleton className="h-44 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : (
                <>
                    <PageSection title={t("sprintsPage.activeTitle")}>
                        {actives.length === 0 ? (
                            <EmptyActive
                                boardId={boardId}
                                hasDrafts={drafts.length > 0}
                                projectId={projectId}
                            />
                        ) : (
                            <div className="grid gap-4">
                                {actives.map((sprint) => (
                                    <ActiveSprintHealthCard
                                        actives={actives}
                                        boardId={boardId}
                                        canManage={canManage}
                                        columns={columns}
                                        drafts={drafts}
                                        key={sprint.id}
                                        projectId={projectId}
                                        sprint={sprint}
                                        tasks={tasks}
                                    />
                                ))}
                            </div>
                        )}
                    </PageSection>

                    <SprintInsightsPanel sprints={sprints} tasks={tasks} />

                    <PageSection
                        count={history.rows.length}
                        title={t("sprints.historyList")}
                    >
                        <SprintHistoryTable
                            boardId={boardId}
                            metric={history.metric}
                            projectId={projectId}
                            rows={history.rows}
                        />
                    </PageSection>

                    {drawer}
                </>
            )}
        </SprintsPageFrame>
    );
}

export function SprintsPageFrame({ children }: { children: ReactNode }) {
    return (
        <div className="mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
            {children}
        </div>
    );
}

export function SprintsPageHeader({
    boardId,
    canManage,
    children,
    project,
    projectId,
    subtitle,
    title,
}: {
    boardId: string;
    canManage: boolean;
    children?: ReactNode;
    project: ReturnType<typeof useProject>["data"];
    projectId: string;
    subtitle?: string;
    title: ReactNode;
}) {
    return (
        <header className="flex min-w-0 flex-col gap-4 border-b border-primary/25 pb-5">
            <BoardSwitcher
                boardId={boardId}
                canManage={canManage}
                destination="sprints"
                projectId={projectId}
                repositories={
                    project && projectHasGithubRepo(project.github_repo_id)
                        ? toBoardSettingsRepositories(project.repositories)
                        : []
                }
            />
            <div className="flex min-w-0 flex-col gap-1.5">
                <h1 className="min-w-0 font-heading text-[clamp(1.75rem,1rem+2vw,2.5rem)] font-bold leading-tight tracking-[-0.03em] text-balance wrap-break-word">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="max-w-2xl text-ui text-muted-foreground">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {children}
        </header>
    );
}

function ActiveSprintHealthCard({
    actives,
    boardId,
    canManage,
    columns,
    drafts,
    projectId,
    sprint,
    tasks,
}: {
    actives: Sprint[];
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean; name: string }>;
    drafts: Sprint[];
    projectId: string;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { i18n, t } = useTranslation("board");
    const navigate = useNavigate();
    const [closeOpen, setCloseOpen] = useState(false);
    const { data: events = [] } = useSprintEvents(sprint.id);
    const today = todayIsoDate();
    const summary = useMemo(
        () => buildSprintReportSummary({ columns, events, sprint, tasks }),
        [columns, events, sprint, tasks]
    );
    const timeline = computeSprintTimeline({
        endsOn: sprint.endsOn,
        startsOn: sprint.startsOn,
        today,
    });
    const dateRange = formatSprintDateRange({
        endsOn: sprint.endsOn,
        locale: i18n.resolvedLanguage,
        startsOn: sprint.startsOn,
        today,
    });
    const members = useMemo(
        () => tasks.filter((task) => task.sprintId === sprint.id),
        [sprint.id, tasks]
    );

    const workPercent = Math.round((summary.completion ?? 0) * 100);
    const timePercent =
        timeline.progress01 === null
            ? null
            : Math.round(timeline.progress01 * 100);
    const unit = t(
        summary.metric === "points" ? "sprints.unitPoints" : "sprints.unitTasks"
    );
    const behind =
        timePercent !== null &&
        (timeline.phase === "overdue" || timePercent - workPercent >= 20);

    const timeLabel =
        timeline.phase === "overdue"
            ? t("sprintsPage.daysOverdue", {
                  count: timeline.daysOverdue ?? 0,
              })
            : timeline.phase === "upcoming"
              ? t("sprintsPage.startsIn", {
                    count:
                        (timeline.daysRemaining ?? 0) -
                        ((timeline.totalDays ?? 1) - 1),
                })
              : timeline.phase === "active"
                ? t("sprintsPage.daysLeft", {
                      count: timeline.daysRemaining ?? 0,
                  })
                : t("sprints.activeLiveUndated");

    const reportParameters = { boardId, projectId, sprintId: sprint.id };

    return (
        <article className="flex min-w-0 flex-col gap-4 border border-primary/40 bg-card/50 px-4 py-4 shadow-[inset_3px_0_0_0_var(--color-primary)] sm:px-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-h3">
                            <Link
                                className="hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                params={reportParameters}
                                to="/projects/$projectId/boards/$boardId/sprints/$sprintId"
                            >
                                {sprint.name}
                            </Link>
                        </h3>
                        <SprintStateBadge state={sprint.state} />
                    </div>
                    {sprint.goal ? (
                        <p className="max-w-2xl text-ui text-muted-foreground text-pretty">
                            {sprint.goal}
                        </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                        {dateRange ? `${dateRange} · ` : ""}
                        <span
                            className={cn(
                                timeline.phase === "overdue" && "text-warning"
                            )}
                        >
                            {timeLabel}
                        </span>
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                        className={cn(
                            buttonVariants({ size: "sm", variant: "outline" }),
                            "rounded-none"
                        )}
                        params={reportParameters}
                        to="/projects/$projectId/boards/$boardId/sprints/$sprintId"
                    >
                        {t("sprints.viewReport")}
                        <ArrowRight data-icon="inline-end" />
                    </Link>
                    {canManage ? (
                        <Button
                            className="rounded-none"
                            onClick={() => setCloseOpen(true)}
                            size="sm"
                            type="button"
                        >
                            {t("sprints.close")}
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <ProgressMeter
                    label={t("sprintsPage.workDone")}
                    percent={workPercent}
                    tone={behind ? "warning" : "primary"}
                    value={t("sprintsPage.workDoneValue", {
                        done: measureValue(summary.done, summary.metric),
                        scope: measureValue(summary.scope, summary.metric),
                        unit,
                    })}
                />
                <ProgressMeter
                    label={t("sprintsPage.timeElapsed")}
                    percent={timePercent}
                    tone="muted"
                    value={
                        timePercent === null
                            ? "—"
                            : t("sprintsPage.percent", {
                                  value: timePercent,
                              })
                    }
                />
            </div>

            <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">
                        {t("sprints.reportStatRemaining")}
                    </dt>
                    <dd className="tabular-nums">
                        {measureValue(summary.remaining, summary.metric)} {unit}
                    </dd>
                </div>
                <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">
                        {t("sprints.reportStatScopeChanges")}
                    </dt>
                    <dd className="tabular-nums">
                        +{summary.scopeAdded} / −{summary.scopeRemoved}
                    </dd>
                </div>
                {summary.scope.unestimated > 0 &&
                summary.metric === "points" ? (
                    <div className="flex gap-1.5">
                        <dt className="text-muted-foreground">
                            {t("sprintsPage.unestimated")}
                        </dt>
                        <dd className="tabular-nums">
                            {summary.scope.unestimated}
                        </dd>
                    </div>
                ) : null}
            </dl>

            <CloseSprintDialog
                activeSprints={actives}
                boardId={boardId}
                columns={columns}
                draftSprints={drafts}
                onClosed={(sprintId) => {
                    void navigate({
                        params: { boardId, projectId, sprintId },
                        to: "/projects/$projectId/boards/$boardId/sprints/$sprintId",
                    });
                }}
                onOpenChange={setCloseOpen}
                open={closeOpen}
                projectId={projectId}
                sprint={sprint}
                tasks={members}
            />
        </article>
    );
}

function EmptyActive({
    boardId,
    hasDrafts,
    projectId,
}: {
    boardId: string;
    hasDrafts: boolean;
    projectId: string;
}) {
    const { t } = useTranslation("board");
    return (
        <div className="flex flex-col items-start gap-3 border border-dashed border-primary/30 bg-card/40 px-4 py-6">
            <p className="text-ui text-muted-foreground">
                {t(
                    hasDrafts
                        ? "sprintsPage.noActiveWithDrafts"
                        : "sprintsPage.noActive"
                )}
            </p>
            <Link
                className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "rounded-none"
                )}
                params={{ boardId, projectId }}
                to="/projects/$projectId/boards/$boardId/backlog"
            >
                {t("sprintsPage.goToBacklog")}
                <ArrowRight data-icon="inline-end" />
            </Link>
        </div>
    );
}

function PageSection({
    children,
    count,
    title,
}: {
    children: ReactNode;
    count?: number;
    title: string;
}) {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-h3">
                {title}
                {count ? (
                    <span className="ml-2 text-meta text-muted-foreground tabular-nums">
                        {count}
                    </span>
                ) : null}
            </h2>
            {children}
        </section>
    );
}

function ProgressMeter({
    label,
    percent,
    tone,
    value,
}: {
    label: string;
    percent: null | number;
    tone: "muted" | "primary" | "warning";
    value: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums">{value}</span>
            </div>
            <div
                aria-label={label}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={percent ?? undefined}
                className="h-1.5 w-full overflow-hidden bg-muted"
                role="progressbar"
            >
                <div
                    className={cn(
                        "h-full transition-[width] duration-500 ease-(--ease-out-expo)",
                        tone === "primary" && "bg-primary",
                        tone === "warning" && "bg-warning",
                        tone === "muted" && "bg-muted-foreground/50"
                    )}
                    style={{ width: `${percent ?? 0}%` }}
                />
            </div>
        </div>
    );
}

function SprintHistoryTable({
    boardId,
    metric,
    projectId,
    rows,
}: {
    boardId: string;
    metric: SprintHistoryMetric;
    projectId: string;
    rows: ReturnType<typeof buildSprintHistoryRows>["rows"];
}) {
    const { i18n, t } = useTranslation("board");
    const today = todayIsoDate();

    if (rows.length === 0) {
        return (
            <p className="border border-dashed border-border bg-card/40 px-4 py-6 text-ui text-muted-foreground">
                {t("sprintsPage.historyEmpty")}
            </p>
        );
    }

    return (
        <div className="scrollbar-board min-w-0 overflow-x-auto border border-border">
            <table className="w-full min-w-xl border-collapse text-left text-ui">
                <caption className="caption-bottom border-t border-border px-3 py-2 text-left text-sm text-muted-foreground">
                    {t(
                        metric === "points"
                            ? "sprintsPage.historyMetricPoints"
                            : "sprintsPage.historyMetricCount"
                    )}
                </caption>
                <thead className="border-b border-border bg-muted/40 text-meta text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 font-normal" scope="col">
                            {t("sprintsPage.columnSprint")}
                        </th>
                        <th className="px-3 py-2 font-normal" scope="col">
                            {t("sprintsPage.columnDates")}
                        </th>
                        <th
                            className="px-3 py-2 text-right font-normal"
                            scope="col"
                        >
                            {t("sprintsPage.columnPlanned")}
                        </th>
                        <th
                            className="px-3 py-2 text-right font-normal"
                            scope="col"
                        >
                            {t("sprintsPage.columnCompleted")}
                        </th>
                        <th className="w-40 px-3 py-2 font-normal" scope="col">
                            {t("sprintsPage.columnCompletion")}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows.map((row) => {
                        const percent =
                            row.completion === null
                                ? null
                                : Math.round(row.completion * 100);
                        return (
                            <tr
                                className="transition-colors hover:bg-primary/5"
                                key={row.sprint.id}
                            >
                                <td className="px-3 py-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <Link
                                            className="font-medium hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            params={{
                                                boardId,
                                                projectId,
                                                sprintId: row.sprint.id,
                                            }}
                                            to="/projects/$projectId/boards/$boardId/sprints/$sprintId"
                                        >
                                            {row.sprint.name}
                                        </Link>
                                        {row.sprint.state === "canceled" ? (
                                            <SprintStateBadge state="canceled" />
                                        ) : null}
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                    {formatSprintDateRange({
                                        endsOn: row.sprint.endsOn,
                                        locale: i18n.resolvedLanguage,
                                        startsOn: row.sprint.startsOn,
                                        today,
                                    }) ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {row.committed}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {row.completed ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                    {percent === null ? (
                                        <span className="text-muted-foreground">
                                            —
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div
                                                aria-hidden
                                                className="h-1.5 flex-1 overflow-hidden bg-muted"
                                            >
                                                <div
                                                    className={cn(
                                                        "h-full",
                                                        percent >= 80
                                                            ? "bg-primary"
                                                            : "bg-warning"
                                                    )}
                                                    style={{
                                                        width: `${Math.min(100, percent)}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="w-10 text-right tabular-nums">
                                                {percent}%
                                            </span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function SprintsPageTabs({
    boardId,
    projectId,
    view,
}: {
    boardId: string;
    projectId: string;
    view: SprintsPageView;
}) {
    const { t } = useTranslation("board");
    const tabs = [
        { label: t("sprintsPage.tabSprints"), view: "sprints" as const },
        { label: t("sprintsPage.tabFlow"), view: "flow" as const },
    ];
    return (
        <nav aria-label={t("sprintsPage.tabsLabel")} className="flex gap-1">
            {tabs.map((tab) => {
                const current = tab.view === view;
                return (
                    <Link
                        aria-current={current ? "page" : undefined}
                        className={cn(
                            "-mb-px border-b-2 px-3 py-1.5 text-ui transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            current
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        key={tab.view}
                        params={{ boardId, projectId }}
                        search={tab.view === "flow" ? { view: "flow" } : {}}
                        to="/projects/$projectId/boards/$boardId/sprints"
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
