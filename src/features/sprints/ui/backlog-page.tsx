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
import { Link, useNavigate } from "@tanstack/react-router";
import {
    ArrowRight,
    ChartColumn,
    MoreHorizontal,
    Play,
    Plus,
    X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type {
    BoardTaskFilters,
    EpicColor,
    Task,
    TaskEstimate,
} from "@/features/tasks";

import { useAuth } from "@/features/auth/model/use-auth";
import {
    BoardSwitcher,
    toBoardSettingsRepositories,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { useProjectLabels } from "@/features/labels";
import { projectHasGithubRepo } from "@/features/projects/model/project-github-gate";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { useProject } from "@/features/projects/model/use-projects";
import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import { buildSprintReportSummary } from "@/features/sprints/model/build-sprint-report-summary";
import { formatSprintDateRange } from "@/features/sprints/model/format-sprint-dates";
import {
    closestScrollRoot,
    offsetToBringSectionToTop,
    scrollPortMetrics,
} from "@/features/sprints/model/scroll-sprint-section";
import { summarizeTaskEstimates } from "@/features/sprints/model/summarize-task-estimates";
import {
    useBoardSprints,
    useSprintMutations,
} from "@/features/sprints/model/use-sprints";
import { useVisibleSprintId } from "@/features/sprints/model/use-visible-sprint-id";
import { ActiveSprintLiveStrip } from "@/features/sprints/ui/active-sprint-live-strip";
import { BacklogAddTask } from "@/features/sprints/ui/backlog-add-task";
import { BacklogEpicsPanel } from "@/features/sprints/ui/backlog-epics-panel";
import {
    CancelSprintDialog,
    CloseSprintDialog,
    StartSprintDialog,
} from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import { SprintStateBadge } from "@/features/sprints/ui/sprint-state-badge";
import {
    BACKLOG_DROP_ID,
    type BacklogTaskDragData,
    parseDropTarget,
    parseEpicDropTarget,
    sprintDropId,
    sprintHeadingId,
    sprintSectionId,
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
    isTaskEstimate,
    sortTasksByBoardSort,
    TaskDrawer,
    toggleFilterValue,
    useBoardCompletedVisibilityStore,
    useBoardSortStore,
    useBoardTasks,
    useProjectEpics,
    useTasksUiStore,
    withoutEpics,
} from "@/features/tasks";
import { EASE_OUT, SPRING_PRESS } from "@/shared/lib/ease";
import { useIdlePreload } from "@/shared/lib/use-idle-preload";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button, buttonVariants } from "@/shared/shadcn/ui/button";
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
import { preloadRichTextEditor } from "@/shared/ui/rich-text-editor";

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
    useIdlePreload(preloadRichTextEditor);
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
    const { createTask, tasks: allBoardTasks, updateTaskDetails } = tasksApi;
    // Epics are listed in the Epics panel — never as Sprint / Backlog rows.
    const tasks = useMemo(() => withoutEpics(allBoardTasks), [allBoardTasks]);
    const { epics, epicsById } = useProjectEpics(projectId);
    const epicFilterOptions = useMemo(
        () =>
            epics
                .filter((epic) => epic.archivedAt === undefined)
                .map((epic) => ({
                    color: epic.color,
                    id: epic.id,
                    key: epic.key,
                    title: epic.title,
                })),
        [epics]
    );
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
    const [onlyUnestimated, setOnlyUnestimated] = useState(false);
    const [bulkMoveValue, setBulkMoveValue] = useState<string | undefined>();

    useEffect(() => {
        setRowSelection({});
        setSearchQuery("");
        setFilters(EMPTY_BOARD_FILTERS);
        setOnlyUnestimated(false);
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

    const actives = sprints.filter((sprint) => sprint.state === "active");
    const drafts = sprints.filter((sprint) => sprint.state === "draft");
    const pastSprintCount = sprints.filter(
        (sprint) => sprint.state === "closed" || sprint.state === "canceled"
    ).length;
    const planningSprints = [...actives, ...drafts];

    const filtersActive =
        isBoardFiltersActive(filters) ||
        searchQuery.trim().length > 0 ||
        hideCompleted ||
        onlyUnestimated;

    const doneColumnIds = useMemo(() => doneColumnIdSet(columns), [columns]);

    const visibleTasks = useMemo(() => {
        const filtered = filterTasks(tasks, filters).filter(
            (task) => !onlyUnestimated || !isTaskEstimate(task.estimate)
        );
        const withoutCompleted = hideCompletedBoardTasks(
            filtered,
            doneColumnIds,
            hideCompleted
        );
        return sortTasksByBoardSort(
            filterTasksBySearchQuery(withoutCompleted, searchQuery),
            boardSort
        );
    }, [
        boardSort,
        doneColumnIds,
        filters,
        hideCompleted,
        onlyUnestimated,
        searchQuery,
        tasks,
    ]);

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
                onlyUnestimated,
                searchQuery,
            }),
        [
            boardId,
            boardSort,
            filters,
            hideCompleted,
            onlyUnestimated,
            searchQuery,
        ]
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

    const handleCreateEpic = async (title: string, color: EpicColor) => {
        if (!firstColumnId) return;
        try {
            const epic = await createTask(firstColumnId, title, {
                epicColor: color,
                taskType: "epic",
            });
            toast.success(t("epics.created", { key: epic.key }));
        } catch {
            toast.error(t("epics.createFailed"));
        }
    };

    const handleToggleEpicFilter = (epicId: string) => {
        setFilters((current) => ({
            ...current,
            epicIds: toggleFilterValue(current.epicIds ?? [], epicId),
        }));
    };

    const handleAddToEpic = (taskIds: string[], epicId: string) => {
        const epic = epicsById.get(epicId);
        if (!epic) return;
        let added = 0;
        let skippedSubtasks = 0;
        for (const id of taskIds) {
            const task = tasks.find((item) => item.id === id);
            if (!task || task.epicId === epicId) continue;
            // Subtasks follow their Parent Task's Epic (ADR 0031).
            if (task.parentId !== undefined) {
                skippedSubtasks += 1;
                continue;
            }
            updateTaskDetails(id, { epicId });
            added += 1;
        }
        if (added > 0) {
            toast.success(
                t("epics.addedToEpic", { count: added, title: epic.title })
            );
            setRowSelection({});
        }
        if (skippedSubtasks > 0) {
            toast.message(t("epics.subtasksFollowParent"));
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

        const epicTargetId = parseEpicDropTarget(event.over?.id);
        if (epicTargetId) {
            handleAddToEpic(data.taskIds, epicTargetId);
            return;
        }

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
        setOnlyUnestimated(false);
    };

    const handleEstimateChange = canManage
        ? (taskId: string, estimate: null | TaskEstimate) => {
              updateTaskDetails(taskId, { estimate });
          }
        : undefined;

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
            <header className="relative flex flex-col gap-4 border-b border-primary/25 pb-5">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 motion-reveal">
                    <BoardSwitcher
                        boardId={boardId}
                        canManage={canManage}
                        destination="backlog"
                        projectId={projectId}
                        repositories={
                            project &&
                            projectHasGithubRepo(project.github_repo_id)
                                ? toBoardSettingsRepositories(
                                      project.repositories
                                  )
                                : []
                        }
                    />
                    <Link
                        className={cn(
                            buttonVariants({ size: "sm", variant: "ghost" }),
                            "rounded-none text-muted-foreground"
                        )}
                        params={{ boardId, projectId }}
                        to="/projects/$projectId/boards/$boardId/sprints"
                    >
                        <ChartColumn data-icon="inline-start" />
                        {t("sprints.openSprintsPage")}
                    </Link>
                </div>

                <div
                    className="flex min-w-0 flex-col gap-3 motion-reveal sm:flex-row sm:items-end sm:justify-between"
                    style={{ animationDelay: "60ms" }}
                >
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="min-w-0 font-heading text-[clamp(1.75rem,1rem+2vw,2.5rem)] font-bold leading-tight tracking-[-0.03em] text-balance wrap-break-word">
                            {t("sprints.backlogTitle")}
                        </h1>
                        <p className="text-ui text-muted-foreground">
                            {t("sprints.backlogSummary", {
                                backlog: backlogTasks.length,
                                sprints: planningSprints.length,
                            })}
                        </p>
                    </div>

                    {canManage ? (
                        <form
                            className="flex min-w-0 gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleCreateDraft();
                            }}
                        >
                            <Input
                                aria-label={t("sprints.newDraftPlaceholder")}
                                className="min-w-0 flex-1 rounded-none border-primary/25 bg-input/30 shadow-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-56 sm:flex-none"
                                onChange={(event) =>
                                    setNewName(event.target.value)
                                }
                                placeholder={t("sprints.newDraftPlaceholder")}
                                value={newName}
                            />
                            <Button
                                className="shrink-0 rounded-none"
                                disabled={
                                    createDraft.isPending || !newName.trim()
                                }
                                size="sm"
                                type="submit"
                            >
                                <Plus data-icon="inline-start" />
                                {t("sprints.createDraft")}
                            </Button>
                        </form>
                    ) : null}
                </div>

                <div
                    className="flex min-w-0 flex-col gap-2 motion-reveal"
                    style={{ animationDelay: "120ms" }}
                >
                    <BoardTaskToolbar
                        epics={epicFilterOptions}
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
                    {onlyUnestimated ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 border border-primary/40 bg-primary/10 px-2 py-1 text-sm">
                                {t("sprints.filterUnestimatedActive")}
                                <button
                                    aria-label={t(
                                        "sprints.filterUnestimatedClear"
                                    )}
                                    className="text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    onClick={() => setOnlyUnestimated(false)}
                                    type="button"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </span>
                        </div>
                    ) : null}
                </div>
            </header>

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

                    <DndContext
                        collisionDetection={backlogCollisionDetection}
                        onDragCancel={handleDragCancel}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        sensors={sensors}
                    >
                        <div className="relative flex flex-col gap-5 sm:gap-6">
                            <div className="motion-reveal [animation-delay:100ms]">
                                <BacklogEpicsPanel
                                    canCreate={Boolean(firstColumnId)}
                                    canManage={canManage}
                                    epics={epics}
                                    onCreateEpic={handleCreateEpic}
                                    onOpenEpic={selectTask}
                                    onToggleEpicFilter={handleToggleEpicFilter}
                                    selectedEpicIds={filters.epicIds ?? []}
                                />
                            </div>
                            {filtersActive &&
                            visibleTasks.length === 0 ? null : (
                                <>
                                    {actives.length > 1 ? (
                                        <ActiveSprintJumpNav
                                            reduceMotion={Boolean(reduceMotion)}
                                            sprints={actives}
                                        />
                                    ) : null}
                                    {planningSprints.map((sprint, index) => (
                                        <div
                                            className="motion-reveal"
                                            key={sprint.id}
                                            style={{
                                                animationDelay: `${120 + index * 80}ms`,
                                            }}
                                        >
                                            <SprintSection
                                                actives={actives}
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
                                                onEstimateChange={
                                                    handleEstimateChange
                                                }
                                                onFilterUnestimated={
                                                    canManage
                                                        ? () => {
                                                              setOnlyUnestimated(
                                                                  true
                                                              );
                                                          }
                                                        : undefined
                                                }
                                                onOpenTask={selectTask}
                                                onRowSelectionChange={
                                                    setRowSelection
                                                }
                                                projectId={projectId}
                                                resetKey={listWindowResetKey}
                                                rowSelection={rowSelection}
                                                sprint={sprint}
                                                tasks={
                                                    tasksBySprint.get(
                                                        sprint.id
                                                    ) ?? []
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
                                            columns={columns}
                                            containerId={BACKLOG_DROP_ID}
                                            draggingTaskIds={draggingTasks.map(
                                                (task) => task.id
                                            )}
                                            epicsById={epicsById}
                                            labels={projectLabels}
                                            onEstimateChange={
                                                handleEstimateChange
                                            }
                                            onOpenTask={selectTask}
                                            onRowSelectionChange={
                                                setRowSelection
                                            }
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

                                    {pastSprintCount > 0 ? (
                                        <Link
                                            className="group flex min-w-0 items-center justify-between gap-3 border border-dashed border-border px-4 py-3 text-ui text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                            params={{ boardId, projectId }}
                                            to="/projects/$projectId/boards/$boardId/sprints"
                                        >
                                            <span>
                                                {t("sprints.historyMovedHint", {
                                                    count: pastSprintCount,
                                                })}
                                            </span>
                                            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                                        </Link>
                                    ) : null}
                                </>
                            )}
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
                                                {t("sprints.draggingCount", {
                                                    count: draggingTasks.length,
                                                })}
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

                    <TaskDrawer
                        boardId={boardId}
                        githubToken={githubAccessToken}
                        projectId={projectId}
                        repositories={project?.repositories ?? []}
                    />
                </>
            )}
        </BacklogPageFrame>
    );
}

function ActiveSprintJumpNav({
    reduceMotion,
    sprints,
}: {
    reduceMotion: boolean;
    sprints: Sprint[];
}) {
    const { t } = useTranslation("board");
    const navReference = useRef<HTMLElement>(null);
    const sentinelReference = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(false);
    const [pinTop, setPinTop] = useState(48);
    const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
    const sprintIds = useMemo(
        () => sprints.map((sprint) => sprint.id),
        [sprints]
    );
    const { currentId, selectId } = useVisibleSprintId({
        enabled: true,
        scrollRoot,
        sprintIds,
    });

    useEffect(() => {
        const sentinel = sentinelReference.current;
        if (!sentinel) return;
        setScrollRoot(closestScrollRoot(sentinel));

        let observer: IntersectionObserver | undefined;
        const bind = () => {
            observer?.disconnect();
            const chromeHeight =
                document.querySelector("header.sticky")?.getBoundingClientRect()
                    .height ?? 48;
            setPinTop(chromeHeight);
            observer = new IntersectionObserver(
                ([entry]) => {
                    setPinned(!(entry?.isIntersecting ?? true));
                },
                {
                    root: null,
                    rootMargin: `-${chromeHeight}px 0px 0px 0px`,
                    threshold: 0,
                }
            );
            observer.observe(sentinel);
        };
        bind();
        window.addEventListener("resize", bind);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", bind);
        };
    }, []);

    const jumpToSprint = (sprintId: string) => {
        selectId(sprintId);
        const section = document.querySelector<HTMLElement>(
            `#${CSS.escape(sprintSectionId(sprintId))}`
        );
        const root = scrollRoot ?? closestScrollRoot(navReference.current);
        if (section && root) {
            const { rootTop, scrollTop } = scrollPortMetrics(root);
            const sectionBox = section.getBoundingClientRect();
            const chromeHeight =
                document.querySelector("header.sticky")?.getBoundingClientRect()
                    .height ?? pinTop;
            const navHeight =
                navReference.current?.getBoundingClientRect().height ?? 40;
            root.scrollTo({
                behavior: reduceMotion ? "auto" : "smooth",
                top: offsetToBringSectionToTop({
                    rootTop,
                    scrollTop,
                    sectionTop: sectionBox.top,
                    stickyOffset: chromeHeight + navHeight,
                }),
            });
        }
        document
            .querySelector<HTMLElement>(
                `#${CSS.escape(sprintHeadingId(sprintId))}`
            )
            ?.focus({ preventScroll: true });
    };

    const nav = (
        <nav
            aria-labelledby="active-sprint-jump-label"
            className={cn(
                "flex min-w-0 flex-wrap items-center gap-2 border-b border-primary/15 bg-background/95 py-2 backdrop-blur-md",
                pinned
                    ? "fixed inset-x-0 z-30 px-4 shadow-[0_8px_24px_-16px_oklch(0_0_0/0.55)] sm:px-6"
                    : "-mx-4 px-4 sm:-mx-6 sm:px-6"
            )}
            id="active-sprint-jump-nav"
            ref={navReference}
            style={pinned ? { top: pinTop } : undefined}
        >
            <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center gap-2">
                <p
                    className="text-meta text-muted-foreground"
                    id="active-sprint-jump-label"
                >
                    {t("sprints.activeJumpNav")}
                </p>
                {sprints.map((sprint) => {
                    const isCurrent = sprint.id === currentId;
                    return (
                        <Button
                            aria-current={isCurrent ? "true" : undefined}
                            className="max-w-48 min-w-0 truncate rounded-none"
                            key={sprint.id}
                            onClick={() => {
                                jumpToSprint(sprint.id);
                            }}
                            size="xs"
                            type="button"
                            variant={isCurrent ? "default" : "outline"}
                        >
                            {sprint.name}
                        </Button>
                    );
                })}
            </div>
        </nav>
    );

    return (
        <>
            <div aria-hidden className="h-px w-full" ref={sentinelReference} />
            {pinned ? <div aria-hidden className="h-10" /> : null}
            {pinned ? createPortal(nav, document.body) : nav}
        </>
    );
}

function BacklogPageFrame({ children }: { children: ReactNode }) {
    return (
        <div className="relative mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-8 px-4 py-6 sm:gap-10 sm:px-6 sm:py-8">
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
    id,
    labelledBy,
    style,
}: {
    accent: BacklogSectionAccent;
    children: ReactNode;
    className?: string;
    header: ReactNode;
    id?: string;
    labelledBy?: string;
    style?: CSSProperties;
}) {
    return (
        <section
            aria-labelledby={labelledBy}
            className={cn(
                "overflow-hidden rounded-none border bg-card/50",
                accent === "active" &&
                    "border-primary/40 shadow-[inset_3px_0_0_0_var(--color-primary)]",
                accent === "draft" &&
                    "border-border shadow-[inset_3px_0_0_0_color-mix(in_oklab,var(--muted-foreground)_40%,transparent)]",
                accent === "pool" &&
                    "border-border shadow-[inset_3px_0_0_0_color-mix(in_oklab,var(--border)_100%,transparent)]",
                accent === "history" && "border-border/80 bg-card/30",
                id && "scroll-mt-16",
                className
            )}
            id={id}
            style={style}
        >
            {header}
            {children}
        </section>
    );
}

function formatSprintSizeLabel(
    t: (key: string, options?: Record<string, unknown>) => string,
    tasks: Task[],
    options: { omitUnestimated?: boolean } = {}
) {
    const summary = summarizeTaskEstimates(tasks);
    if (summary.estimatedCount === 0) {
        return t("sprints.taskCount", { count: summary.taskCount });
    }
    if (summary.unestimatedCount === 0 || options.omitUnestimated) {
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

function sortBySprintPosition(tasks: Task[]) {
    return tasks.toSorted((left, right) => {
        const leftPos = left.sprintPosition ?? Number.MAX_SAFE_INTEGER;
        const rightPos = right.sprintPosition ?? Number.MAX_SAFE_INTEGER;
        if (leftPos !== rightPos) return leftPos - rightPos;
        return left.key.localeCompare(right.key);
    });
}

function SprintSection({
    actives,
    allTasks,
    boardId,
    canManage,
    columns,
    drafts,
    draggingTaskIds,
    firstColumnId,
    labels,
    onEstimateChange,
    onFilterUnestimated,
    onOpenTask,
    onRowSelectionChange,
    projectId,
    resetKey,
    rowSelection,
    sprint,
    tasks,
}: {
    actives: Sprint[];
    allTasks: Task[];
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string; isDone: boolean; name: string }>;
    drafts: Sprint[];
    draggingTaskIds: string[];
    firstColumnId?: string;
    labels: Parameters<typeof SprintTaskTable>[0]["labels"];
    onEstimateChange?: (taskId: string, estimate: null | TaskEstimate) => void;
    onFilterUnestimated?: () => void;
    onOpenTask: (taskId: string) => void;
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    projectId: string;
    resetKey: string;
    rowSelection: RowSelectionState;
    sprint: Sprint;
    /** Member Tasks that pass the toolbar filters (table rows). */
    tasks: Task[];
}) {
    const { i18n, t } = useTranslation("board");
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const { removeDraft } = useSprintMutations(projectId, boardId);
    const { epicsById } = useProjectEpics(projectId);
    const [startOpen, setStartOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);

    // Dialogs act on every member, not only the rows the toolbar filters show.
    const memberTasks = useMemo(
        () => allTasks.filter((task) => task.sprintId === sprint.id),
        [allTasks, sprint.id]
    );
    const unestimatedCount = memberTasks.filter(
        (task) => !isTaskEstimate(task.estimate)
    ).length;
    const isActive = sprint.state === "active";
    const progress = useMemo(
        () =>
            isActive
                ? buildSprintReportSummary({
                      columns,
                      events: [],
                      sprint,
                      tasks: allTasks,
                  })
                : undefined,
        [allTasks, columns, isActive, sprint]
    );
    const dateRange = formatSprintDateRange({
        endsOn: sprint.endsOn,
        locale: i18n.resolvedLanguage,
        startsOn: sprint.startsOn,
        today: todayIsoDate(),
    });
    const unestimatedChip =
        onFilterUnestimated && unestimatedCount > 0 ? (
            <button
                className="border border-dashed border-warning/60 px-1.5 py-px text-meta text-warning transition-colors hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={onFilterUnestimated}
                type="button"
            >
                {t("sprints.unestimatedChip", { count: unestimatedCount })}
            </button>
        ) : null;
    const sizeLabel = formatSprintSizeLabel(t, tasks, {
        omitUnestimated: unestimatedChip !== null,
    });

    const sprintActions = (
        <>
            {isActive ? (
                <Link
                    className={cn(
                        buttonVariants({ size: "xs", variant: "outline" }),
                        "rounded-none"
                    )}
                    params={{ boardId, projectId, sprintId: sprint.id }}
                    to="/projects/$projectId/boards/$boardId/sprints/$sprintId"
                >
                    {t("sprints.showReport")}
                    <ArrowRight data-icon="inline-end" />
                </Link>
            ) : null}
            {canManage && sprint.state === "draft" ? (
                <motion.div
                    className="inline-flex"
                    transition={SPRING_PRESS}
                    whileHover={reduceMotion ? undefined : { x: 3, y: -1 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                >
                    <Button
                        className="rounded-none shadow-[2px_2px_0_0_color-mix(in_oklab,var(--primary)_45%,transparent)]"
                        onClick={() => setStartOpen(true)}
                        size="sm"
                        type="button"
                    >
                        <Play data-icon="inline-start" />
                        {t("sprints.start")}
                    </Button>
                </motion.div>
            ) : null}
            {canManage && isActive ? (
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
                        memberTasks.length === 0 ? (
                            <DropdownMenuItem
                                onClick={() => {
                                    void removeDraft
                                        .mutateAsync(sprint.id)
                                        .then(() =>
                                            toast.success(
                                                t("sprints.draftDeleted")
                                            )
                                        )
                                        .catch(() =>
                                            toast.error(
                                                t("sprints.draftDeleteFailed")
                                            )
                                        );
                                }}
                                variant="destructive"
                            >
                                {t("sprints.deleteDraft")}
                            </DropdownMenuItem>
                        ) : null}
                        {isActive ||
                        (sprint.state === "draft" && memberTasks.length > 0) ? (
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
        </>
    );

    return (
        <BacklogSectionShell
            accent={isActive ? "active" : "draft"}
            header={
                isActive ? (
                    <header>
                        <ActiveSprintLiveStrip
                            actions={sprintActions}
                            dateRange={dateRange}
                            headingId={sprintHeadingId(sprint.id)}
                            meta={unestimatedChip}
                            progress={progress}
                            sizeLabel={sizeLabel}
                            sprint={sprint}
                        />
                    </header>
                ) : (
                    <header className="flex min-w-0 flex-col gap-2 border-b border-border/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-h3">{sprint.name}</h2>
                                <SprintStateBadge state={sprint.state} />
                                <span className="text-meta text-muted-foreground">
                                    {sizeLabel}
                                </span>
                                {unestimatedChip}
                            </div>
                            {sprint.goal ? (
                                <p className="mt-1 max-w-2xl text-ui text-muted-foreground">
                                    {sprint.goal}
                                </p>
                            ) : null}
                            {dateRange ? (
                                <p className="text-sm text-muted-foreground">
                                    {dateRange}
                                </p>
                            ) : null}
                        </div>
                        {sprintActions}
                    </header>
                )
            }
            id={isActive ? sprintSectionId(sprint.id) : undefined}
            labelledBy={isActive ? sprintHeadingId(sprint.id) : undefined}
        >
            <WindowedSprintTaskTable
                canManage={canManage}
                columns={columns}
                containerId={sprintDropId(sprint.id)}
                draggingTaskIds={draggingTaskIds}
                epicsById={epicsById}
                labels={labels}
                onEstimateChange={onEstimateChange}
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
                taskCount={memberTasks.length}
            />
            <CloseSprintDialog
                activeSprints={actives}
                boardId={boardId}
                columns={columns}
                draftSprints={drafts}
                onClosed={(closedSprintId) => {
                    void navigate({
                        params: {
                            boardId,
                            projectId,
                            sprintId: closedSprintId,
                        },
                        to: "/projects/$projectId/boards/$boardId/sprints/$sprintId",
                    });
                }}
                onOpenChange={setCloseOpen}
                open={closeOpen}
                projectId={projectId}
                sprint={sprint}
                tasks={memberTasks}
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
