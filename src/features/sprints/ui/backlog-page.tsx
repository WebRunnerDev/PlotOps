import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

import {
    closestCenter,
    type CollisionDetection,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import NumberFlow from "@number-flow/react";
import { ChevronDown, MoreHorizontal, Play, Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type { BoardTaskFilters, Task } from "@/features/tasks";

import { useAuth } from "@/features/auth/model/use-auth";
import {
    BoardSwitcher,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { useProject } from "@/features/projects/model/use-projects";
import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import { buildSprintBurndownSeries } from "@/features/sprints/model/build-sprint-burndown-series";
import { summarizeCarryoverByTaskId } from "@/features/sprints/model/carryover-targets";
import { computeSprintTimeline } from "@/features/sprints/model/compute-sprint-timeline";
import { listSprintCompletionTasks } from "@/features/sprints/model/list-sprint-completion-tasks";
import {
    BACKLOG_LIST_PAGE_SIZE,
    windowListItems,
} from "@/features/sprints/model/list-window";
import { summarizeTaskEstimates } from "@/features/sprints/model/summarize-task-estimates";
import { useListWindow } from "@/features/sprints/model/use-list-window";
import {
    useBoardSprints,
    useSprintEvents,
    useSprintMutations,
} from "@/features/sprints/model/use-sprints";
import { ActiveSprintLiveStrip } from "@/features/sprints/ui/active-sprint-live-strip";
import { BacklogAddTask } from "@/features/sprints/ui/backlog-add-task";
import { ListWindowControls } from "@/features/sprints/ui/list-window-controls";
import { SprintBurndownChart } from "@/features/sprints/ui/sprint-burndown-chart";
import { SprintInsightsPanel } from "@/features/sprints/ui/sprint-insights-panel";
import {
    CancelSprintDialog,
    CloseSprintDialog,
    StartSprintDialog,
} from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import {
    BACKLOG_DROP_ID,
    type BacklogTaskDragData,
    parseDropTarget,
    sprintDropId,
    SprintTaskTable,
} from "@/features/sprints/ui/sprint-task-table";
import { WindowedSprintTaskTable } from "@/features/sprints/ui/windowed-sprint-task-table";
import {
    BoardTaskToolbar,
    DEFAULT_BOARD_SORT,
    doneColumnIdSet,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    filterTasksBySearchQuery,
    hideCompletedBoardTasks,
    isBoardFiltersActive,
    sortTasksByBoardSort,
    TaskDrawer,
    useBoardCompletedVisibilityStore,
    useBoardSortStore,
    useBoardTasks,
    useTasksUiStore,
} from "@/features/tasks";
import { EASE_OUT, SPRING_PRESS } from "@/shared/lib/ease";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button } from "@/shared/shadcn/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import { Input } from "@/shared/shadcn/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const backlogCollisionDetection: CollisionDetection = (collisionArguments) => {
    const dropContainers = collisionArguments.droppableContainers.filter(
        (container) => String(container.id).startsWith("drop:")
    );
    const scoped = {
        ...collisionArguments,
        droppableContainers: dropContainers,
    };
    const pointerHits = pointerWithin(scoped);
    if (pointerHits.length > 0) return pointerHits;
    return closestCenter(scoped);
};

type BacklogPageProperties = {
    boardId: string;
    projectId: string;
};

type BacklogSectionAccent = "active" | "draft" | "history" | "pool";

export function BacklogPage({ boardId, projectId }: BacklogPageProperties) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();
    const { githubAccessToken } = useAuth();
    const { canManageBoard, isSettled } = useProjectAccess(projectId);
    const canManage = isSettled && canManageBoard;
    const { data: project } = useProject(projectId);
    const {
        data: boards,
        error: boardsQueryError,
        isPending: boardsLoading,
        refetch: refetchBoards,
    } = useProjectBoards(projectId);
    const { labels } = useProjectLabels(projectId);
    const people = useProjectPeople(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const columnsApi = useBoardColumns(projectId, boardId);
    const tasksApi = useBoardTasks(projectId, boardId);
    const { columns } = columnsApi;
    const { tasks } = tasksApi;
    const boardSort = useBoardSortStore(
        (state) => state.byBoardId[boardId] ?? DEFAULT_BOARD_SORT
    );
    const setBoardSort = useBoardSortStore((state) => state.setBoardSort);
    const hideCompleted = useBoardCompletedVisibilityStore(
        (state) => state.hideCompletedByBoardId[boardId] === true
    );
    const setHideCompleted = useBoardCompletedVisibilityStore(
        (state) => state.setHideCompleted
    );
    const {
        data: sprintsData,
        error: sprintsQueryError,
        isLoading: sprintsLoading,
        refetch: refetchSprints,
    } = useBoardSprints(boardId);
    const boardsList = boards ?? [];
    const sprints = sprintsData ?? [];
    // Refetch failures keep prior cache — don't replace the page with "no access".
    const sprintsError =
        Boolean(sprintsQueryError) && sprintsData === undefined;
    const boardsError = Boolean(boardsQueryError) && boards === undefined;
    const error =
        (Boolean(columnsApi.error) && !columnsApi.columnsReady) ||
        (Boolean(tasksApi.error) && !tasksApi.tasksReady);
    const isLoading = columnsApi.isLoading || tasksApi.isLoading;
    const { createDraft, moveTasks, moveTasksToSprint } = useSprintMutations(
        projectId,
        boardId
    );
    const [newName, setNewName] = useState("");
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [draggingTasks, setDraggingTasks] = useState<Task[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [bulkMoveValue, setBulkMoveValue] = useState<string | undefined>();

    useEffect(() => {
        setRowSelection({});
        setSearchQuery("");
        setFilters(EMPTY_BOARD_FILTERS);
        setHistoryOpen(false);
        setBulkMoveValue(undefined);
        setNewName("");
    }, [boardId]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    );

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const active = sprints.find((sprint) => sprint.state === "active");
    const drafts = sprints.filter((sprint) => sprint.state === "draft");
    const activeTimeline = useMemo(() => {
        if (!active) return null;
        return computeSprintTimeline({
            endsOn: active.endsOn,
            startsOn: active.startsOn,
            today: todayIsoDate(),
        });
    }, [active?.endsOn, active?.id, active?.startsOn]);
    const pastSprints = useMemo(() => {
        const past = sprints.filter(
            (sprint) => sprint.state === "closed" || sprint.state === "canceled"
        );
        return past.toSorted((left, right) => {
            const leftAt = left.closedAt ?? left.canceledAt ?? left.createdAt;
            const rightAt =
                right.closedAt ?? right.canceledAt ?? right.createdAt;
            return rightAt.localeCompare(leftAt);
        });
    }, [sprints]);
    const planningSprints = [...(active ? [active] : []), ...drafts];

    const filtersActive =
        isBoardFiltersActive(filters) ||
        searchQuery.trim().length > 0 ||
        hideCompleted;

    const doneColumnIds = useMemo(() => doneColumnIdSet(columns), [columns]);

    const visibleTasks = useMemo(() => {
        const filtered = filterTasks(tasks, filters);
        const withoutCompleted = hideCompletedBoardTasks(
            filtered,
            doneColumnIds,
            hideCompleted
        );
        return sortTasksByBoardSort(
            filterTasksBySearchQuery(withoutCompleted, searchQuery),
            boardSort
        );
    }, [boardSort, doneColumnIds, filters, hideCompleted, searchQuery, tasks]);

    const backlogTasks = useMemo(() => {
        const group = visibleTasks.filter((task) => !task.sprintId);
        return boardSort.field === "manual"
            ? sortBySprintPosition(group)
            : group;
    }, [boardSort.field, visibleTasks]);

    const listWindowResetKey = useMemo(
        () =>
            JSON.stringify({
                boardId,
                boardSort,
                filters,
                hideCompleted,
                searchQuery,
            }),
        [boardId, boardSort, filters, hideCompleted, searchQuery]
    );

    const historyWindow = useListWindow(listWindowResetKey);
    const windowedPastSprints = windowListItems(
        pastSprints,
        historyWindow.visibleCount
    );

    const tasksBySprint = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const sprint of planningSprints) {
            const group = visibleTasks.filter(
                (task) => task.sprintId === sprint.id
            );
            map.set(
                sprint.id,
                boardSort.field === "manual"
                    ? sortBySprintPosition(group)
                    : group
            );
        }
        return map;
    }, [boardSort.field, planningSprints, visibleTasks]);

    const selectedCount = Object.values(rowSelection).filter(Boolean).length;
    const moveTargets = useMemo(
        () => [
            { id: null as null | string, label: t("sprints.backlog") },
            ...planningSprints.map((sprint) => ({
                id: sprint.id as null | string,
                label: sprint.name,
            })),
        ],
        [planningSprints, t]
    );

    const handleMoveMany = async (
        taskIds: string[],
        targetSprintId: null | string
    ) => {
        try {
            const updates = await moveTasksToSprint(taskIds, targetSprintId);
            if (updates.length === 0) return;

            const movingIds = updates.map((update) => update.taskId);
            setRowSelection((previous) => {
                const next = { ...previous };
                for (const id of movingIds) {
                    delete next[id];
                }
                return next;
            });
            setBulkMoveValue(undefined);
        } catch {
            toast.error(
                taskIds.length > 1
                    ? t("sprints.moveManyFailed")
                    : t("sprints.moveFailed")
            );
        }
    };

    const handleCreateDraft = async () => {
        const name = newName.trim();
        if (!name) return;
        try {
            await createDraft.mutateAsync({ name });
            setNewName("");
            toast.success(t("sprints.draftCreated"));
        } catch {
            toast.error(t("sprints.draftCreateFailed"));
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current as
            BacklogTaskDragData | undefined;
        if (data?.type !== "backlog-task") return;
        const moved: Task[] = [];
        for (const id of data.taskIds) {
            const task = tasks.find((item) => item.id === id);
            if (task) moved.push(task);
        }
        setDraggingTasks(moved);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const data = event.active.data.current as
            BacklogTaskDragData | undefined;
        setDraggingTasks([]);
        if (data?.type !== "backlog-task") return;

        const target = parseDropTarget(event.over?.id);
        if (!target) return;
        if (data.sourceContainerId === event.over?.id) return;

        void handleMoveMany(data.taskIds, target.sprintId);
    };

    const handleDragCancel = () => {
        setDraggingTasks([]);
    };

    const handleBulkMove = (targetValue: string | undefined) => {
        if (!targetValue) return;
        const selectedIds = Object.keys(rowSelection).filter(
            (id) => rowSelection[id]
        );
        void handleMoveMany(
            selectedIds,
            targetValue === "backlog" ? null : targetValue
        );
    };

    const clearFilters = () => {
        setSearchQuery("");
        setFilters(EMPTY_BOARD_FILTERS);
    };

    if (sprintsError) {
        return (
            <BacklogPageFrame>
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("sprints.loadFailed")}
                    </AlertDescription>
                </Alert>
                <Button
                    onClick={() => void refetchSprints()}
                    type="button"
                    variant="outline"
                >
                    {t("sprints.retry")}
                </Button>
            </BacklogPageFrame>
        );
    }

    if (error) {
        return (
            <BacklogPageFrame>
                <Alert variant="destructive">
                    <AlertDescription>{t("boardLoadFailed")}</AlertDescription>
                </Alert>
            </BacklogPageFrame>
        );
    }

    if (boardsError) {
        return (
            <BacklogPageFrame>
                <Alert variant="destructive">
                    <AlertDescription>{t("boardsLoadFailed")}</AlertDescription>
                </Alert>
                <Button
                    onClick={() => void refetchBoards()}
                    type="button"
                    variant="outline"
                >
                    {t("sprints.retry")}
                </Button>
            </BacklogPageFrame>
        );
    }

    if (!boardsLoading && !boardsList.some((board) => board.id === boardId)) {
        return (
            <BacklogPageFrame>
                <Alert variant="destructive">
                    <AlertDescription>{t("boardNotFound")}</AlertDescription>
                </Alert>
            </BacklogPageFrame>
        );
    }

    const showBodySpinner = isLoading || sprintsLoading || boardsLoading;
    const firstColumnId = columns[0]?.id;

    return (
        <BacklogPageFrame>
            <header className="relative flex flex-col gap-5 border-b border-primary/25 pb-5 sm:gap-6 sm:pb-6">
                <div
                    className="flex min-w-0 flex-wrap items-center gap-2 motion-reveal"
                    style={{ animationDelay: "0ms" }}
                >
                    <BoardSwitcher
                        boardId={boardId}
                        canManage={canManage}
                        defaultBaseBranch={
                            project?.github_default_branch ?? "main"
                        }
                        destination="backlog"
                        projectId={projectId}
                    />
                </div>

                <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                    <p
                        className="font-mono text-meta text-primary uppercase tracking-[0.14em] motion-reveal"
                        style={{ animationDelay: "40ms" }}
                    >
                        {t("sprints.planningEyebrow")}
                    </p>
                    <h1
                        className="min-w-0 font-heading text-[clamp(2.125rem,1rem+3.8vw,3.75rem)] font-bold leading-[0.94] tracking-[-0.045em] text-balance wrap-break-word motion-reveal"
                        style={{ animationDelay: "120ms" }}
                    >
                        {t("sprints.backlogTitle")}
                    </h1>
                    <div
                        aria-hidden
                        className="h-px w-14 origin-left bg-primary/70 motion-reveal"
                        style={{ animationDelay: "200ms" }}
                    />
                    <p
                        className="max-w-2xl text-body text-muted-foreground motion-reveal"
                        style={{ animationDelay: "260ms" }}
                    >
                        {t("sprints.backlogSubtitle")}
                    </p>
                </div>

                <dl
                    className="grid grid-cols-3 gap-px overflow-hidden rounded-none border border-primary/25 bg-primary/25 motion-reveal"
                    style={{ animationDelay: "320ms" }}
                >
                    <PlanningPulseStat
                        emphasize={Boolean(active)}
                        label={
                            active &&
                            activeTimeline &&
                            activeTimeline.daysRemaining !== null
                                ? t("sprints.pulseDaysLeft")
                                : t("sprints.pulseActive")
                        }
                        value={
                            active &&
                            activeTimeline &&
                            activeTimeline.daysRemaining !== null
                                ? activeTimeline.daysRemaining
                                : active
                                  ? 1
                                  : 0
                        }
                    />
                    <PlanningPulseStat
                        label={t("sprints.pulseDrafts")}
                        value={drafts.length}
                    />
                    <PlanningPulseStat
                        label={t("sprints.pulsePool")}
                        value={backlogTasks.length}
                    />
                </dl>

                {canManage ? (
                    <div
                        className="flex min-w-0 flex-col gap-2 motion-reveal sm:flex-row sm:flex-wrap sm:items-center"
                        style={{ animationDelay: "380ms" }}
                    >
                        <Input
                            className="min-w-0 w-full rounded-none border-primary/25 bg-input/30 font-mono text-code shadow-none transition-[border-color,box-shadow] duration-300 ease-(--ease-out-expo) focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 sm:max-w-xs"
                            onChange={(event) => setNewName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleCreateDraft();
                                }
                            }}
                            placeholder={t("sprints.newDraftPlaceholder")}
                            value={newName}
                        />
                        <Button
                            className="rounded-none transition-transform duration-300 ease-(--ease-out-expo) enabled:hover:-translate-y-0.5"
                            disabled={createDraft.isPending || !newName.trim()}
                            onClick={() => void handleCreateDraft()}
                            size="sm"
                            type="button"
                        >
                            <Plus data-icon="inline-start" />
                            {t("sprints.createDraft")}
                        </Button>
                    </div>
                ) : null}

                <div
                    className="motion-reveal"
                    style={{ animationDelay: "440ms" }}
                >
                    <BoardTaskToolbar
                        filters={filters}
                        hideCompleted={hideCompleted}
                        labels={projectLabels}
                        onChange={setFilters}
                        onHideCompletedChange={(next) => {
                            setHideCompleted(boardId, next);
                        }}
                        onSearchQueryChange={setSearchQuery}
                        onSortChange={(sort) => {
                            setBoardSort(boardId, sort);
                        }}
                        people={people}
                        searchQuery={searchQuery}
                        sort={boardSort}
                    />
                </div>
            </header>

            {!showBodySpinner && active ? (
                <ActiveSprintLiveStrip
                    sizeLabel={formatSprintSizeLabel(
                        t,
                        tasksBySprint.get(active.id) ?? []
                    )}
                    sprint={active}
                />
            ) : null}

            {showBodySpinner ? (
                <div className="relative flex h-48 items-center justify-center motion-reveal [animation-delay:120ms]">
                    <Spinner className="size-8 text-primary" />
                </div>
            ) : (
                <>
                    {canManage && planningSprints.length === 0 ? (
                        <Alert className="relative motion-reveal rounded-none border-primary/25 [animation-delay:80ms]">
                            <AlertDescription>
                                {t("sprints.emptyPlanningHint")}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {filtersActive && visibleTasks.length === 0 ? (
                        <div className="relative flex flex-col items-start gap-3 border border-dashed border-primary/30 bg-card/40 px-4 py-8 motion-reveal [animation-delay:100ms]">
                            <p className="text-ui text-muted-foreground">
                                {t("sprints.noFilterMatches")}
                            </p>
                            <Button
                                className="rounded-none"
                                onClick={clearFilters}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {t("sprints.clearFilters")}
                            </Button>
                        </div>
                    ) : null}

                    {canManage && selectedCount > 0 ? (
                        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
                            <motion.div
                                animate={{ opacity: 1, y: 0 }}
                                className="pointer-events-auto flex w-full min-w-0 max-w-6xl flex-col items-stretch gap-2 rounded-none border border-primary bg-background/95 px-3 py-2.5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)] backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center"
                                initial={
                                    reduceMotion ? false : { opacity: 0, y: 20 }
                                }
                                transition={{ duration: 0.45, ease: EASE_OUT }}
                            >
                                <p className="text-ui whitespace-nowrap">
                                    {t("sprints.selectedCount", {
                                        count: selectedCount,
                                    })}
                                </p>
                                <p className="hidden text-meta text-muted-foreground sm:inline">
                                    {t("sprints.dragSelectedHint")}
                                </p>
                                <Select
                                    disabled={moveTasks.isPending}
                                    onValueChange={(value) => {
                                        const next = value ?? undefined;
                                        setBulkMoveValue(next);
                                        handleBulkMove(next);
                                    }}
                                    value={bulkMoveValue}
                                >
                                    <SelectTrigger
                                        aria-label={t("sprints.moveSelected")}
                                        className="w-full min-w-0 rounded-none sm:min-w-44"
                                        size="sm"
                                    >
                                        <span>
                                            {t(
                                                "sprints.moveSelectedPlaceholder"
                                            )}
                                        </span>
                                    </SelectTrigger>
                                    <SelectContent alignItemWithTrigger={false}>
                                        {moveTargets.map((target) => (
                                            <SelectItem
                                                key={target.id ?? "backlog"}
                                                value={target.id ?? "backlog"}
                                            >
                                                {target.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => setRowSelection({})}
                                    size="xs"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t("sprints.clearSelection")}
                                </Button>
                            </motion.div>
                        </div>
                    ) : null}

                    {filtersActive && visibleTasks.length === 0 ? null : (
                        <DndContext
                            collisionDetection={backlogCollisionDetection}
                            onDragCancel={handleDragCancel}
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                            sensors={sensors}
                        >
                            <div className="relative flex flex-col gap-5 sm:gap-6">
                                {planningSprints.map((sprint, index) => (
                                    <div
                                        className="motion-reveal"
                                        key={sprint.id}
                                        style={{
                                            animationDelay: `${120 + index * 80}ms`,
                                        }}
                                    >
                                        <SprintSection
                                            activeSprint={active}
                                            allTasks={tasks}
                                            boardId={boardId}
                                            canManage={canManage}
                                            columns={columns}
                                            drafts={drafts}
                                            draggingTaskIds={draggingTasks.map(
                                                (task) => task.id
                                            )}
                                            firstColumnId={firstColumnId}
                                            labels={projectLabels}
                                            onOpenTask={selectTask}
                                            onRowSelectionChange={
                                                setRowSelection
                                            }
                                            projectId={projectId}
                                            resetKey={listWindowResetKey}
                                            rowSelection={rowSelection}
                                            sprint={sprint}
                                            tasks={
                                                tasksBySprint.get(sprint.id) ??
                                                []
                                            }
                                        />
                                    </div>
                                ))}

                                <BacklogSectionShell
                                    accent="pool"
                                    className="motion-reveal"
                                    header={
                                        <header className="flex min-w-0 flex-col gap-1 border-b border-border/80 px-3 py-3 sm:px-4">
                                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                <h2 className="text-h3">
                                                    {t("sprints.backlog")}
                                                </h2>
                                                <p className="text-meta text-muted-foreground">
                                                    {formatSprintSizeLabel(
                                                        t,
                                                        backlogTasks
                                                    )}
                                                </p>
                                            </div>
                                            <p className="text-ui text-muted-foreground">
                                                {t(
                                                    "sprints.backlogPoolDescription"
                                                )}
                                            </p>
                                        </header>
                                    }
                                    style={{
                                        animationDelay: `${120 + planningSprints.length * 80}ms`,
                                    }}
                                >
                                    <WindowedSprintTaskTable
                                        canManage={canManage}
                                        containerId={BACKLOG_DROP_ID}
                                        draggingTaskIds={draggingTasks.map(
                                            (task) => task.id
                                        )}
                                        labels={projectLabels}
                                        onOpenTask={selectTask}
                                        onRowSelectionChange={setRowSelection}
                                        resetKey={listWindowResetKey}
                                        rowSelection={rowSelection}
                                        tasks={backlogTasks}
                                    />
                                    {firstColumnId ? (
                                        <div className="border-t border-border/80 px-1">
                                            <BacklogAddTask
                                                boardId={boardId}
                                                projectId={projectId}
                                                sprintId={null}
                                                status={firstColumnId}
                                            />
                                        </div>
                                    ) : null}
                                </BacklogSectionShell>

                                {pastSprints.length > 0 ? (
                                    <section
                                        className="space-y-3 motion-reveal"
                                        style={{
                                            animationDelay: `${200 + planningSprints.length * 80}ms`,
                                        }}
                                    >
                                        <button
                                            className="group flex min-w-0 items-center gap-2 text-left transition-colors duration-300 ease-(--ease-out-expo) hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                            onClick={() =>
                                                setHistoryOpen(
                                                    (value) => !value
                                                )
                                            }
                                            type="button"
                                        >
                                            <ChevronDown
                                                aria-hidden
                                                className={cn(
                                                    "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-(--ease-out-expo) group-hover:text-primary",
                                                    historyOpen
                                                        ? ""
                                                        : "-rotate-90"
                                                )}
                                            />
                                            <span className="text-h3">
                                                {t("sprints.historyList")}
                                            </span>
                                            <span className="text-meta text-muted-foreground">
                                                ({pastSprints.length})
                                            </span>
                                        </button>
                                        {historyOpen ? (
                                            <>
                                                {windowedPastSprints.visible.map(
                                                    (sprint) => (
                                                        <PastSprintSection
                                                            boardId={boardId}
                                                            canManage={
                                                                canManage
                                                            }
                                                            columns={columns}
                                                            key={sprint.id}
                                                            projectId={
                                                                projectId
                                                            }
                                                            sprint={sprint}
                                                            tasks={tasks}
                                                        />
                                                    )
                                                )}
                                                <ListWindowControls
                                                    bordered={false}
                                                    hasMore={
                                                        windowedPastSprints.hasMore
                                                    }
                                                    nextCount={Math.min(
                                                        BACKLOG_LIST_PAGE_SIZE,
                                                        windowedPastSprints.remaining
                                                    )}
                                                    onLoadMore={() => {
                                                        historyWindow.loadMore(
                                                            pastSprints.length
                                                        );
                                                    }}
                                                    onShowAll={() => {
                                                        historyWindow.showAll(
                                                            pastSprints.length
                                                        );
                                                    }}
                                                />
                                            </>
                                        ) : null}
                                    </section>
                                ) : null}
                            </div>

                            <DragOverlay dropAnimation={null}>
                                {draggingTasks.length > 0 ? (
                                    <div className="flex w-72 max-w-[min(18rem,calc(100vw-2rem))] cursor-grabbing flex-col gap-1 rounded-none border border-primary/40 bg-background px-3 py-2.5 shadow-lg ring-1 ring-primary/20">
                                        {draggingTasks.length === 1 ? (
                                            <>
                                                <p className="text-code text-muted-foreground">
                                                    {draggingTasks[0]?.key}
                                                </p>
                                                <p className="truncate text-ui">
                                                    {draggingTasks[0]?.title}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="whitespace-nowrap text-ui">
                                                    {t(
                                                        "sprints.draggingCount",
                                                        {
                                                            count: draggingTasks.length,
                                                        }
                                                    )}
                                                </p>
                                                <p className="truncate text-meta text-muted-foreground">
                                                    {draggingTasks[0]?.key}
                                                    {" · "}
                                                    {draggingTasks[0]?.title}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )}

                    <div className="relative motion-reveal [animation-delay:360ms]">
                        <SprintInsightsPanel sprints={sprints} tasks={tasks} />
                    </div>

                    <TaskDrawer
                        boardId={boardId}
                        githubToken={githubAccessToken}
                        projectId={projectId}
                        repoFullName={project?.github_full_name ?? undefined}
                    />
                </>
            )}
        </BacklogPageFrame>
    );
}

function BacklogPageFrame({ children }: { children: ReactNode }) {
    return (
        <div className="relative mx-auto flex h-full w-full min-w-0 max-w-6xl scroll-smooth flex-col gap-8 overflow-y-auto px-4 py-6 scrollbar-board sm:gap-10 sm:px-6 sm:py-8">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-auth-atmosphere opacity-85 sm:-top-10 sm:h-80"
            />
            <div className="relative flex flex-col gap-8 sm:gap-10">
                {children}
            </div>
        </div>
    );
}

function BacklogSectionShell({
    accent,
    children,
    className,
    header,
    style,
}: {
    accent: BacklogSectionAccent;
    children: ReactNode;
    className?: string;
    header: ReactNode;
    style?: CSSProperties;
}) {
    return (
        <section
            className={cn(
                "overflow-hidden rounded-none border bg-card/50",
                accent === "active" &&
                    "border-primary/40 shadow-[inset_3px_0_0_0_var(--color-primary)]",
                accent === "draft" &&
                    "border-border shadow-[inset_3px_0_0_0_color-mix(in_oklab,var(--muted-foreground)_40%,transparent)]",
                accent === "pool" &&
                    "border-border shadow-[inset_3px_0_0_0_color-mix(in_oklab,var(--border)_100%,transparent)]",
                accent === "history" && "border-border/80 bg-card/30",
                className
            )}
            style={style}
        >
            {header}
            {children}
        </section>
    );
}

function formatSprintSizeLabel(
    t: (key: string, options?: Record<string, unknown>) => string,
    tasks: Task[]
) {
    const summary = summarizeTaskEstimates(tasks);
    if (summary.estimatedCount === 0) {
        return t("sprints.taskCount", { count: summary.taskCount });
    }
    if (summary.unestimatedCount === 0) {
        return t("sprints.sizeWithPoints", {
            count: summary.taskCount,
            points: summary.pointsSum,
        });
    }
    return t("sprints.sizeWithPointsPartial", {
        count: summary.taskCount,
        points: summary.pointsSum,
        unestimated: summary.unestimatedCount,
    });
}

function PastSprintSection({
    boardId,
    canManage,
    columns,
    projectId,
    sprint,
    tasks,
}: {
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean }>;
    projectId: string;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { t } = useTranslation("board");
    const { removePast } = useSprintMutations(projectId, boardId);
    const [reportOpen, setReportOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const isCanceled = sprint.state === "canceled";

    const handleDelete = async () => {
        try {
            await removePast.mutateAsync(sprint.id);
            toast.success(t("sprints.pastDeleted", { name: sprint.name }));
            setDeleteOpen(false);
        } catch {
            toast.error(t("sprints.pastDeleteFailed"));
        }
    };

    return (
        <BacklogSectionShell
            accent="history"
            header={
                <header className="flex min-w-0 flex-col gap-2 border-b border-border/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-h3">{sprint.name}</h2>
                            <SprintStateBadge state={sprint.state} />
                        </div>
                        {sprint.startsOn && sprint.endsOn ? (
                            <p className="text-code text-muted-foreground">
                                {sprint.startsOn} → {sprint.endsOn}
                            </p>
                        ) : null}
                        {isCanceled && sprint.canceledAt ? (
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.canceledAt", {
                                    date: new Date(
                                        sprint.canceledAt
                                    ).toLocaleString(),
                                })}
                            </p>
                        ) : null}
                        {!isCanceled && sprint.closedAt ? (
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.closedAt", {
                                    date: new Date(
                                        sprint.closedAt
                                    ).toLocaleString(),
                                })}
                            </p>
                        ) : null}
                    </div>
                    <Button
                        className="rounded-none"
                        onClick={() => setReportOpen((value) => !value)}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        {reportOpen
                            ? t("sprints.hideReport")
                            : isCanceled
                              ? t("sprints.showDetails")
                              : t("sprints.showReport")}
                    </Button>
                    {canManage ? (
                        <Button
                            onClick={() => setDeleteOpen(true)}
                            size="xs"
                            type="button"
                            variant="ghost"
                        >
                            {t("sprints.deletePast")}
                        </Button>
                    ) : null}
                </header>
            }
        >
            {reportOpen ? (
                <SprintReportPanel
                    boardId={boardId}
                    canManage={canManage}
                    columns={columns}
                    projectId={projectId}
                    sprint={sprint}
                    tasks={tasks}
                />
            ) : null}

            <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("sprints.deletePastTitle", {
                                name: sprint.name,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("sprints.deletePastDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removePast.isPending}>
                            {t("sprints.deletePastKeep")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={removePast.isPending}
                            onClick={() => {
                                void handleDelete();
                            }}
                            variant="destructive"
                        >
                            {t("sprints.deletePastConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </BacklogSectionShell>
    );
}

function PlanningPulseStat({
    emphasize = false,
    label,
    value,
}: {
    emphasize?: boolean;
    label: string;
    value: number;
}) {
    const reduceMotion = useReducedMotion();
    return (
        <div className="flex min-w-0 flex-col gap-1 bg-background/90 px-3 py-3 sm:px-4 sm:py-3.5">
            <dt className="truncate text-meta text-muted-foreground">
                {label}
            </dt>
            <dd
                className={cn(
                    "font-heading text-h3 tabular-nums tracking-tight",
                    emphasize ? "text-primary" : "text-foreground"
                )}
            >
                {reduceMotion ? (
                    value
                ) : (
                    <NumberFlow isolate value={value} willChange />
                )}
            </dd>
        </div>
    );
}

function sortBySprintPosition(tasks: Task[]) {
    return tasks.toSorted((left, right) => {
        const leftPos = left.sprintPosition ?? Number.MAX_SAFE_INTEGER;
        const rightPos = right.sprintPosition ?? Number.MAX_SAFE_INTEGER;
        if (leftPos !== rightPos) return leftPos - rightPos;
        return left.key.localeCompare(right.key);
    });
}

function SprintReportPanel({
    boardId,
    canManage,
    columns,
    projectId,
    sprint,
    tasks,
}: {
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean }>;
    projectId: string;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { t } = useTranslation("board");
    const { moveTasks } = useSprintMutations(projectId, boardId);
    const { data: events = [], isLoading } = useSprintEvents(sprint.id);
    const committed = sprint.committedTaskIds.length;
    const completed = sprint.completedTaskIds.length;
    const scopeAdds = events.filter(
        (event) => event.eventType === "task_added"
    ).length;
    const scopeRemoves = events.filter(
        (event) => event.eventType === "task_removed"
    ).length;
    const isCanceled = sprint.state === "canceled";
    const carryoverSummary = useMemo(() => {
        const closed = events.find((event) => event.eventType === "closed");
        return summarizeCarryoverByTaskId(
            closed?.payload?.carryover_by_task_id
        );
    }, [events]);

    const estimateLines = useMemo(() => {
        const byId = new Map(tasks.map((task) => [task.id, task]));
        const resolve = (ids: string[]) =>
            ids.map((id) => byId.get(id) ?? { estimate: undefined });
        return {
            committed: summarizeTaskEstimates(resolve(sprint.committedTaskIds)),
            completed: summarizeTaskEstimates(resolve(sprint.completedTaskIds)),
        };
    }, [sprint.committedTaskIds, sprint.completedTaskIds, tasks]);

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

    const completedRows = useMemo(
        () =>
            listSprintCompletionTasks({
                completedTaskIds: sprint.completedTaskIds,
                sprintId: sprint.id,
                tasks,
            }),
        [sprint.completedTaskIds, sprint.id, tasks]
    );

    return (
        <div className="space-y-3 border-t border-border px-3 py-3">
            {isCanceled ? (
                <p className="text-ui text-muted-foreground">
                    {t("sprints.canceledSummary")}
                </p>
            ) : (
                <>
                    {estimateLines.committed.estimatedCount > 0 ||
                    estimateLines.completed.estimatedCount > 0 ? (
                        <p className="text-ui">
                            {t("sprints.reportPoints", {
                                committedPoints:
                                    estimateLines.committed.pointsSum,
                                completedPoints:
                                    estimateLines.completed.pointsSum,
                            })}
                        </p>
                    ) : null}
                    <p
                        className={
                            estimateLines.committed.estimatedCount > 0 ||
                            estimateLines.completed.estimatedCount > 0
                                ? "text-ui text-muted-foreground"
                                : "text-ui"
                        }
                    >
                        {t("sprints.reportSummary", { committed, completed })}
                    </p>
                    {estimateLines.committed.unestimatedCount > 0 ? (
                        <p className="text-ui text-muted-foreground">
                            {t("sprints.reportUnestimated", {
                                count: estimateLines.committed.unestimatedCount,
                            })}
                        </p>
                    ) : null}
                    {sprint.state === "closed" && completedRows.length > 0 ? (
                        <div className="space-y-1">
                            <p className="text-ui text-muted-foreground">
                                {t("sprints.reportCompletedList")}
                            </p>
                            <ul className="max-h-40 space-y-1 overflow-y-auto text-code">
                                {completedRows.map((row) => (
                                    <li
                                        className="flex min-w-0 items-center gap-2"
                                        key={row.id}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {row.key ? (
                                                <>
                                                    <span className="text-foreground">
                                                        {row.key}
                                                    </span>
                                                    {row.title
                                                        ? ` · ${row.title}`
                                                        : ""}
                                                    {row.stillMember
                                                        ? ""
                                                        : ` · ${t("sprints.reportCompletedMoved")}`}
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        "sprints.reportCompletedMissing",
                                                        {
                                                            id: row.id.slice(
                                                                0,
                                                                8
                                                            ),
                                                        }
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                        {canManage && row.stillMember ? (
                                            <Button
                                                className="shrink-0"
                                                disabled={moveTasks.isPending}
                                                onClick={() => {
                                                    void moveTasks
                                                        .mutateAsync([
                                                            {
                                                                sprintId: null,
                                                                sprintPosition:
                                                                    null,
                                                                taskId: row.id,
                                                            },
                                                        ])
                                                        .then(() => {
                                                            toast.success(
                                                                t(
                                                                    "sprints.reportMoveToBacklogDone"
                                                                )
                                                            );
                                                        })
                                                        .catch(() => {
                                                            toast.error(
                                                                t(
                                                                    "sprints.reportMoveToBacklogFailed"
                                                                )
                                                            );
                                                        });
                                                }}
                                                size="xs"
                                                type="button"
                                                variant="outline"
                                            >
                                                {t(
                                                    "sprints.reportMoveToBacklog"
                                                )}
                                            </Button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {sprint.state === "active" || sprint.state === "closed" ? (
                        <SprintBurndownChart
                            mode={
                                sprint.state === "active" ? "active" : "closed"
                            }
                            series={burndownSeries}
                        />
                    ) : null}
                </>
            )}
            <p className="text-ui text-muted-foreground">
                {t("sprints.reportScope", {
                    added: scopeAdds,
                    removed: scopeRemoves,
                })}
            </p>
            {carryoverSummary ? (
                <p className="text-ui text-muted-foreground">
                    {t("sprints.reportCarryover", {
                        backlog: carryoverSummary.backlogCount,
                        drafts: carryoverSummary.draftCount,
                    })}
                </p>
            ) : null}
            {isLoading ? <Spinner className="size-4" /> : null}
            <ul className="space-y-1 text-code text-muted-foreground">
                {events.map((event) => (
                    <li key={event.id}>
                        {t(`sprints.event.${event.eventType}`)}
                        {event.taskId ? ` · ${event.taskId.slice(0, 8)}` : ""}
                        {" · "}
                        {new Date(event.createdAt).toLocaleString()}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SprintSection({
    activeSprint,
    allTasks,
    boardId,
    canManage,
    columns,
    drafts,
    draggingTaskIds,
    firstColumnId,
    labels,
    onOpenTask,
    onRowSelectionChange,
    projectId,
    resetKey,
    rowSelection,
    sprint,
    tasks,
}: {
    activeSprint?: Sprint;
    allTasks: Task[];
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean }>;
    drafts: Sprint[];
    draggingTaskIds: string[];
    firstColumnId?: string;
    labels: Parameters<typeof SprintTaskTable>[0]["labels"];
    onOpenTask: (taskId: string) => void;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    projectId: string;
    resetKey: string;
    rowSelection: RowSelectionState;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { t } = useTranslation("board");
    const reduceMotion = useReducedMotion();
    const { removeDraft } = useSprintMutations(projectId, boardId);
    const [startOpen, setStartOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    return (
        <BacklogSectionShell
            accent={sprint.state === "active" ? "active" : "draft"}
            header={
                <header className="flex min-w-0 flex-col gap-2 border-b border-border/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
                    <div className="min-w-0 flex-1">
                        {sprint.state === "active" ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <SprintStateBadge state={sprint.state} />
                                <span className="text-meta text-muted-foreground">
                                    {formatSprintSizeLabel(t, tasks)}
                                </span>
                                <span className="sr-only">{sprint.name}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-h3">{sprint.name}</h2>
                                    <SprintStateBadge state={sprint.state} />
                                    <span className="text-meta text-muted-foreground">
                                        {formatSprintSizeLabel(t, tasks)}
                                    </span>
                                </div>
                                {sprint.goal ? (
                                    <p className="mt-1 max-w-2xl text-ui text-muted-foreground">
                                        {sprint.goal}
                                    </p>
                                ) : null}
                                {sprint.startsOn && sprint.endsOn ? (
                                    <p className="text-code text-muted-foreground">
                                        {sprint.startsOn} → {sprint.endsOn}
                                    </p>
                                ) : null}
                            </>
                        )}
                    </div>
                    {sprint.state === "active" ? (
                        <Button
                            className="rounded-none"
                            onClick={() => setReportOpen((value) => !value)}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {reportOpen
                                ? t("sprints.hideReport")
                                : t("sprints.showReport")}
                        </Button>
                    ) : null}
                    {canManage && sprint.state === "draft" ? (
                        <motion.div
                            className="inline-flex"
                            transition={SPRING_PRESS}
                            whileHover={
                                reduceMotion || activeSprint
                                    ? undefined
                                    : { x: 3, y: -1 }
                            }
                            whileTap={
                                reduceMotion || activeSprint
                                    ? undefined
                                    : { scale: 0.97 }
                            }
                        >
                            <Button
                                className="rounded-none shadow-[2px_2px_0_0_color-mix(in_oklab,var(--primary)_45%,transparent)]"
                                disabled={Boolean(activeSprint)}
                                onClick={() => setStartOpen(true)}
                                size="sm"
                                title={
                                    activeSprint
                                        ? t("sprints.startBlockedActive")
                                        : undefined
                                }
                                type="button"
                            >
                                <Play data-icon="inline-start" />
                                {t("sprints.start")}
                            </Button>
                        </motion.div>
                    ) : null}
                    {canManage && sprint.state === "active" ? (
                        <Button
                            className="rounded-none"
                            onClick={() => setCloseOpen(true)}
                            size="xs"
                            type="button"
                        >
                            {t("sprints.close")}
                        </Button>
                    ) : null}
                    {canManage ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        aria-label={t("sprints.sprintActions")}
                                        size="icon-xs"
                                        type="button"
                                        variant="ghost"
                                    />
                                }
                            >
                                <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {sprint.state === "draft" &&
                                tasks.length === 0 ? (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            void removeDraft
                                                .mutateAsync(sprint.id)
                                                .then(() =>
                                                    toast.success(
                                                        t(
                                                            "sprints.draftDeleted"
                                                        )
                                                    )
                                                )
                                                .catch(() =>
                                                    toast.error(
                                                        t(
                                                            "sprints.draftDeleteFailed"
                                                        )
                                                    )
                                                );
                                        }}
                                        variant="destructive"
                                    >
                                        {t("sprints.deleteDraft")}
                                    </DropdownMenuItem>
                                ) : null}
                                {sprint.state === "active" ||
                                (sprint.state === "draft" &&
                                    tasks.length > 0) ? (
                                    <DropdownMenuItem
                                        onClick={() => setCancelOpen(true)}
                                        variant="destructive"
                                    >
                                        {t("sprints.cancel")}
                                    </DropdownMenuItem>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                </header>
            }
        >
            {reportOpen && sprint.state === "active" ? (
                <SprintReportPanel
                    boardId={boardId}
                    canManage={canManage}
                    columns={columns}
                    projectId={projectId}
                    sprint={sprint}
                    tasks={allTasks}
                />
            ) : null}

            <WindowedSprintTaskTable
                canManage={canManage}
                containerId={sprintDropId(sprint.id)}
                draggingTaskIds={draggingTaskIds}
                labels={labels}
                onOpenTask={onOpenTask}
                onRowSelectionChange={onRowSelectionChange}
                resetKey={resetKey}
                rowSelection={rowSelection}
                tasks={tasks}
            />
            {firstColumnId ? (
                <div className="border-t border-border/80 px-1">
                    <BacklogAddTask
                        boardId={boardId}
                        projectId={projectId}
                        sprintId={sprint.id}
                        status={firstColumnId}
                    />
                </div>
            ) : null}

            <StartSprintDialog
                boardId={boardId}
                onOpenChange={setStartOpen}
                open={startOpen}
                projectId={projectId}
                sprint={sprint}
                taskCount={tasks.length}
            />
            <CloseSprintDialog
                boardId={boardId}
                columns={columns}
                draftSprints={drafts}
                onOpenChange={setCloseOpen}
                open={closeOpen}
                projectId={projectId}
                sprint={sprint}
                tasks={tasks}
            />
            <CancelSprintDialog
                boardId={boardId}
                onOpenChange={setCancelOpen}
                open={cancelOpen}
                projectId={projectId}
                sprint={sprint}
            />
        </BacklogSectionShell>
    );
}

function SprintStateBadge({ state }: { state: Sprint["state"] }) {
    const { t } = useTranslation("board");
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-meta",
                state === "active" && "text-primary",
                state === "draft" && "text-muted-foreground",
                state === "closed" && "text-muted-foreground",
                state === "canceled" && "text-warning"
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "size-1.5 shrink-0",
                    state === "active" && "bg-primary",
                    state === "draft" && "bg-muted-foreground/60",
                    state === "closed" && "bg-muted-foreground/40",
                    state === "canceled" && "bg-warning"
                )}
            />
            {t(`sprints.state.${state}`)}
        </span>
    );
}
