import {
    defaultDropAnimationSideEffects,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type DropAnimation,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    horizontalListSortingStrategy,
    SortableContext,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { type BoardColumn, useBoardColumns } from "@/features/boards";
import { type ProjectLabel, useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import {
    filterLiveBoardTasks,
    resolveCreateTaskSprintId,
    resolveEffectiveBoardSprintScope,
    useBoardSprints,
    useSprintsUiStore,
} from "@/features/sprints";
import {
    type BoardTaskFilters,
    BoardTaskSelectionBar,
    BoardTaskToolbar,
    DEFAULT_BOARD_SORT,
    doneColumnIdSet,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    filterTasksBySearchQuery,
    hideCompletedBoardTasks,
    isWithinColumnDragEnabled,
    parentSubtaskProgress,
    sortTasksByBoardSort,
    type SubtaskProgress,
    type Task,
    TaskCard,
    TaskDrawer,
    useBoardCompletedVisibilityStore,
    useBoardSortStore,
    useBoardSubtaskVisibilityStore,
    useBoardTasks,
    useBoardTaskSelectionStore,
    visibleBoardTasks,
} from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { boardCollisionDetection } from "@/widgets/kanban-board/model/board-collision-detection";
import {
    BoardMouseSensor,
    BoardTouchSensor,
} from "@/widgets/kanban-board/model/board-pointer-sensor";
import { isBoardTaskViewRestricted } from "@/widgets/kanban-board/model/is-board-task-view-restricted";
import {
    resolveBoardMouseActivation,
    resolveBoardTouchActivation,
} from "@/widgets/kanban-board/model/resolve-board-drag-activation";
import { resolveCrossColumnDragTaskIds } from "@/widgets/kanban-board/model/resolve-cross-column-drag-task-ids";

import { BoardLoading } from "./board-loading";
import { KanbanColumn } from "./kanban-column";

type DragType = "column" | "task";

const dropAnimation: DropAnimation = {
    duration: 220,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: { opacity: "0.4" },
        },
    }),
};

type KanbanBoardProperties = {
    boardId: string;
    githubToken: null | string;
    /** Increments when Board chrome + New Task should open create on the first column. */
    openCreateTaskRequestKey?: number;
    projectId: string;
    repoFullName: string | undefined;
};

export function KanbanBoard({
    boardId,
    githubToken,
    openCreateTaskRequestKey = 0,
    projectId,
    repoFullName,
}: KanbanBoardProperties) {
    const { t } = useTranslation("board");
    const columnsApi = useBoardColumns(projectId, boardId);
    const labelsApi = useProjectLabels(projectId);
    const people = useProjectPeople(projectId);
    const tasksApi = useBoardTasks(projectId, boardId);
    const { canEditTasks, canManageBoard, isSettled } =
        useProjectAccess(projectId);
    const { data: sprints = [] } = useBoardSprints(boardId);
    const boardSprintScope = useSprintsUiStore(
        (state) => state.boardSprintScope
    );
    const boardSort = useBoardSortStore(
        (state) => state.byBoardId[boardId] ?? DEFAULT_BOARD_SORT
    );
    const setBoardSort = useBoardSortStore((state) => state.setBoardSort);
    const hideSubtasks = useBoardSubtaskVisibilityStore(
        (state) => state.hideSubtasksByBoardId[boardId] === true
    );
    const setHideSubtasks = useBoardSubtaskVisibilityStore(
        (state) => state.setHideSubtasks
    );
    const hideCompleted = useBoardCompletedVisibilityStore(
        (state) => state.hideCompletedByBoardId[boardId] === true
    );
    const setHideCompleted = useBoardCompletedVisibilityStore(
        (state) => state.setHideCompleted
    );
    const withinColumnDragEnabled = isWithinColumnDragEnabled(boardSort);
    const syncBoardSelection = useBoardTaskSelectionStore(
        (state) => state.syncBoard
    );
    const clearBoardSelection = useBoardTaskSelectionStore(
        (state) => state.clearSelection
    );
    const activeSprint = sprints.find((sprint) => sprint.state === "active");
    const effectiveBoardSprintScope = resolveEffectiveBoardSprintScope({
        boardSprintScope,
        hasActiveSprint: activeSprint !== undefined,
    });
    const createSprintId = resolveCreateTaskSprintId({
        activeSprintId: activeSprint?.id,
        boardSprintScope: effectiveBoardSprintScope,
    });
    const selectedIds = useBoardTaskSelectionStore(
        (state) => state.selectedIds
    );
    const selectionBoardId = useBoardTaskSelectionStore(
        (state) => state.boardId
    );
    const [activeTask, setActiveTask] = useState<Task | undefined>();
    const [activeDragCount, setActiveDragCount] = useState(1);
    const [activeColumn, setActiveColumn] = useState<BoardColumn | undefined>();
    const [focusColumnId, setFocusColumnId] = useState<string | undefined>();
    const [focusAddTaskColumnId, setFocusAddTaskColumnId] = useState<
        string | undefined
    >();
    const lastCreateTaskRequestKey = useRef(0);
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        syncBoardSelection(boardId);
    }, [boardId, syncBoardSelection]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                clearBoardSelection();
            }
        };
        globalThis.addEventListener("keydown", onKeyDown);
        return () => globalThis.removeEventListener("keydown", onKeyDown);
    }, [clearBoardSelection]);

    const sensors = useSensors(
        useSensor(BoardMouseSensor, {
            activationConstraint: resolveBoardMouseActivation(),
        }),
        useSensor(BoardTouchSensor, {
            activationConstraint: resolveBoardTouchActivation(),
        })
    );

    const { columns } = columnsApi;
    const { labels } = labelsApi;
    const {
        commitTaskDragGesture,
        moveTasksToColumn,
        reorderTaskWithin,
        rollbackTaskDragGesture,
        tasks,
    } = tasksApi;
    const columnIds = columns.map((column) => column.id);
    const canEdit = isSettled && canEditTasks;
    const canManage = isSettled && canManageBoard;

    const isLoading =
        columnsApi.isLoading || labelsApi.isLoading || tasksApi.isLoading;
    // Labels/sprints soft-fail: board is still usable. Refetch errors must not
    // unmount columns while TanStack Query still has cached workspace data.
    const blockingError =
        (Boolean(columnsApi.error) && !columnsApi.columnsReady
            ? columnsApi.error
            : null) ??
        (Boolean(tasksApi.error) && !tasksApi.tasksReady
            ? tasksApi.error
            : null);

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const labelsById = useMemo(() => {
        const map = new Map<string, ProjectLabel>();
        for (const label of projectLabels) {
            map.set(label.id, label);
        }
        return map;
    }, [projectLabels]);

    const doneColumnIds = useMemo(() => doneColumnIdSet(columns), [columns]);

    const filteredTasks = useMemo(() => {
        const scoped = filterLiveBoardTasks({
            activeSprintId: activeSprint?.id,
            scope: effectiveBoardSprintScope,
            sprints,
            tasks,
        });
        const filtered = filterTasks(scoped, filters);
        const visible = visibleBoardTasks(filtered, hideSubtasks);
        const withoutCompleted = hideCompletedBoardTasks(
            visible,
            doneColumnIds,
            hideCompleted
        );
        return filterTasksBySearchQuery(withoutCompleted, searchQuery);
    }, [
        activeSprint?.id,
        doneColumnIds,
        effectiveBoardSprintScope,
        filters,
        hideCompleted,
        hideSubtasks,
        searchQuery,
        sprints,
        tasks,
    ]);

    const displayedTasks = useMemo(
        () => sortTasksByBoardSort(filteredTasks, boardSort),
        [boardSort, filteredTasks]
    );

    const subtaskProgressByTaskId = useMemo(() => {
        const nodes = tasks.map((task) => ({
            id: task.id,
            isDone: doneColumnIds.has(task.status),
            parentId: task.parentId,
        }));
        const map = new Map<string, SubtaskProgress>();
        for (const task of tasks) {
            if (task.parentId !== undefined) continue;
            const progress = parentSubtaskProgress(task.id, nodes);
            if (progress) {
                map.set(task.id, progress);
            }
        }
        return map;
    }, [doneColumnIds, tasks]);

    const boardTaskViewRestricted = isBoardTaskViewRestricted(
        tasks,
        displayedTasks
    );

    const displayedTaskIds = useMemo(
        () => new Set(displayedTasks.map((task) => task.id)),
        [displayedTasks]
    );

    const labelsByTaskId = useMemo(() => {
        const map = new Map<string, ProjectLabel[]>();
        for (const task of displayedTasks) {
            const resolved =
                task.labelIds
                    ?.map((id) => labelsById.get(id))
                    .filter(
                        (label): label is ProjectLabel => label !== undefined
                    ) ?? [];
            map.set(task.id, resolved);
        }
        return map;
    }, [displayedTasks, labelsById]);

    useEffect(() => {
        setSearchQuery("");
        setFilters(EMPTY_BOARD_FILTERS);
    }, [boardId]);

    useEffect(() => {
        if (!focusColumnId) return;
        const timer = globalThis.setTimeout(() => {
            setFocusColumnId(undefined);
        }, 0);
        return () => globalThis.clearTimeout(timer);
    }, [focusColumnId]);

    useEffect(() => {
        if (!focusAddTaskColumnId) return;
        const timer = globalThis.setTimeout(() => {
            setFocusAddTaskColumnId(undefined);
        }, 0);
        return () => globalThis.clearTimeout(timer);
    }, [focusAddTaskColumnId]);

    useEffect(() => {
        if (
            !openCreateTaskRequestKey ||
            openCreateTaskRequestKey === lastCreateTaskRequestKey.current
        ) {
            return;
        }
        const firstColumnId = columns[0]?.id;
        if (!firstColumnId) return;

        lastCreateTaskRequestKey.current = openCreateTaskRequestKey;
        setFocusAddTaskColumnId(firstColumnId);

        globalThis.requestAnimationFrame(() => {
            const node = document.querySelector(
                `[data-column-id="${firstColumnId}"]`
            );
            node?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "start",
            });
        });
    }, [columns, openCreateTaskRequestKey]);

    const clearActiveDrag = () => {
        setActiveTask(undefined);
        setActiveDragCount(1);
        setActiveColumn(undefined);
    };

    const selectionIdsForBoard =
        selectionBoardId === boardId ? selectedIds : new Set<string>();

    const handleDragStart = (event: DragStartEvent) => {
        const type = event.active.data.current?.type as DragType | undefined;

        if (type === "column") {
            if (!canManage) return;
            setActiveColumn(
                columns.find((column) => column.id === event.active.id)
            );
            return;
        }

        if (type === "task") {
            if (!canEdit) return;
            const activeId = String(event.active.id);
            const dragIds = resolveCrossColumnDragTaskIds({
                activeId,
                selectedIds: selectionIdsForBoard,
            });
            setActiveDragCount(dragIds.length);
            setActiveTask(displayedTasks.find((item) => item.id === activeId));
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as DragType | undefined;

        // Columns: visual gap only via horizontalListSortingStrategy — live
        // reorder on every dragOver thrash with collision and flicker the preview.
        if (activeType === "column") return;

        if (activeType !== "task") return;
        if (!canEdit) return;

        // Only move across columns here; same-column ordering is handled
        // visually by the sort strategy and committed on drop.
        const dragIds = resolveCrossColumnDragTaskIds({
            activeId: String(active.id),
            selectedIds: selectionIdsForBoard,
        });
        moveTasksToColumn(dragIds, String(over.id), {
            displayedTaskIds: boardTaskViewRestricted
                ? displayedTaskIds
                : undefined,
            persist: false,
        });
    };

    const handleDragCancel = () => {
        columnsApi.rollbackColumnDragGesture();
        rollbackTaskDragGesture();
        clearActiveDrag();
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        clearActiveDrag();

        const activeType = active.data.current?.type as DragType | undefined;

        if (activeType === "column") {
            if (!canManage) {
                columnsApi.rollbackColumnDragGesture();
                return;
            }
            if (!over || active.id === over.id) {
                columnsApi.rollbackColumnDragGesture();
                return;
            }
            // Single persist on drop — preview came from the sort strategy.
            columnsApi.reorderColumns(String(active.id), String(over.id), {
                persist: true,
            });
            return;
        }

        if (activeType !== "task") return;
        if (!canEdit) {
            rollbackTaskDragGesture();
            return;
        }

        const dragIds = resolveCrossColumnDragTaskIds({
            activeId: String(active.id),
            selectedIds: selectionIdsForBoard,
        });
        const clearMultiSelectionAfterDrop = () => {
            if (dragIds.length > 1) {
                clearBoardSelection();
            }
        };

        if (!over || active.id === over.id) {
            // Cross-column preview may still need committing, or cancel.
            // If over is missing/same id after a cross-column preview, keep the
            // previewed placement and persist; pure cancel goes through onDragCancel.
            commitTaskDragGesture();
            clearMultiSelectionAfterDrop();
            return;
        }

        const overType = over.data.current?.type as DragType | undefined;

        // Multi-select: cross-column only — skip within-column reorder for a set.
        if (
            overType === "task" &&
            withinColumnDragEnabled &&
            dragIds.length === 1
        ) {
            const activeTaskStatus = displayedTasks.find(
                (task) => task.id === String(active.id)
            )?.status;
            const visibleColumnTaskIds =
                boardTaskViewRestricted && activeTaskStatus
                    ? displayedTasks
                          .filter((task) => task.status === activeTaskStatus)
                          .map((task) => task.id)
                    : undefined;

            reorderTaskWithin(String(active.id), String(over.id), {
                persist: false,
                visibleColumnTaskIds,
            });
        }

        commitTaskDragGesture();
        clearMultiSelectionAfterDrop();
    };

    const handleAddColumn = () => {
        void columnsApi
            .addColumn(t("columns.newStatus"))
            .then((id) => {
                setFocusColumnId(id);

                globalThis.requestAnimationFrame(() => {
                    const node = document.querySelector(
                        `[data-column-id="${id}"]`
                    );
                    node?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "end",
                    });
                });
            })
            .catch(() => {
                // Toast comes from useBoardColumns onError.
            });
    };
    if (isLoading) {
        return <BoardLoading variant="columns" />;
    }

    if (blockingError) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{t("boardLoadFailed")}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="sticky left-0 z-5 w-[calc(100cqw-1.5rem)] shrink-0 sm:w-[calc(100cqw-6rem)]">
                <BoardTaskToolbar
                    filters={filters}
                    hideCompleted={hideCompleted}
                    hideSubtasks={hideSubtasks}
                    labels={projectLabels}
                    onChange={setFilters}
                    onHideCompletedChange={(next) => {
                        setHideCompleted(boardId, next);
                    }}
                    onHideSubtasksChange={(next) => {
                        setHideSubtasks(boardId, next);
                    }}
                    onSearchQueryChange={setSearchQuery}
                    onSortChange={(sort) => {
                        setBoardSort(boardId, sort);
                    }}
                    people={people}
                    searchQuery={searchQuery}
                    showSubtaskVisibility
                    sort={boardSort}
                />
            </div>

            <DndContext
                collisionDetection={boardCollisionDetection}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                sensors={sensors}
            >
                <SortableContext
                    items={columnIds}
                    strategy={horizontalListSortingStrategy}
                >
                    <div className="flex min-h-0 min-w-full w-max flex-1 items-stretch gap-1">
                        {columns.map((column) => (
                            <KanbanColumn
                                boardId={boardId}
                                createSprintId={createSprintId}
                                key={column.id}
                                labelsByTaskId={labelsByTaskId}
                                name={column.name}
                                projectId={projectId}
                                startAddingTask={
                                    focusAddTaskColumnId === column.id
                                }
                                startEditing={focusColumnId === column.id}
                                status={column.id}
                                subtaskProgressByTaskId={
                                    subtaskProgressByTaskId
                                }
                                tasks={displayedTasks.filter(
                                    (task) => task.status === column.id
                                )}
                                withinColumnDragEnabled={
                                    withinColumnDragEnabled
                                }
                            />
                        ))}

                        {canManage ? (
                            <div className="flex w-48 shrink-0 flex-col pt-0.5">
                                <Button
                                    className="justify-start gap-2 rounded-none text-muted-foreground transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-primary"
                                    onClick={handleAddColumn}
                                    type="button"
                                    variant="ghost"
                                >
                                    <Plus className="size-4" />
                                    {t("columns.add")}
                                </Button>
                            </div>
                        ) : undefined}
                    </div>
                </SortableContext>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeTask ? (
                        <div className="relative rotate-2 scale-[1.03] cursor-grabbing shadow-2xl shadow-primary/20 duration-150 ease-out animate-in zoom-in-95">
                            <TaskCard
                                labels={labelsByTaskId.get(activeTask.id) ?? []}
                                subtaskProgress={subtaskProgressByTaskId.get(
                                    activeTask.id
                                )}
                                task={activeTask}
                            />
                            {activeDragCount > 1 ? (
                                <span
                                    aria-label={t("selection.dragCount", {
                                        count: activeDragCount,
                                    })}
                                    className="absolute -top-2 -right-2 inline-flex min-w-5 items-center justify-center rounded-md border border-border bg-primary px-1.5 py-0.5 text-meta font-semibold text-primary-foreground shadow-sm"
                                >
                                    {activeDragCount}
                                </span>
                            ) : undefined}
                        </div>
                    ) : undefined}
                    {activeColumn ? (
                        <div className="flex h-40 w-72 items-start border border-border bg-card/95 p-3 opacity-95 shadow-lg ring-1 ring-primary/40">
                            <p className="text-meta font-medium">
                                {activeColumn.name}
                            </p>
                        </div>
                    ) : undefined}
                </DragOverlay>
            </DndContext>

            <TaskDrawer
                boardId={boardId}
                githubToken={githubToken}
                projectId={projectId}
                repoFullName={repoFullName}
            />
            <BoardTaskSelectionBar boardId={boardId} projectId={projectId} />
        </div>
    );
}
