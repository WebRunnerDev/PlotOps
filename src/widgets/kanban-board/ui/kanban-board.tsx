import {
    closestCorners,
    type CollisionDetection,
    defaultDropAnimationSideEffects,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type DropAnimation,
    pointerWithin,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { type BoardColumn, useBoardColumns } from "@/features/boards";
import { type ProjectLabel, useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    filterLiveBoardTasks,
    resolveCreateTaskSprintId,
    useBoardSprints,
    useSprintsUiStore,
} from "@/features/sprints";
import {
    BoardSortControl,
    type BoardTaskFilters,
    BoardTaskFiltersBar,
    BoardTaskSelectionBar,
    DEFAULT_BOARD_SORT,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    isWithinColumnDragEnabled,
    sortTasksByBoardSort,
    type Task,
    TaskCard,
    TaskDrawer,
    useBoardSortStore,
    useBoardTasks,
    useBoardTaskSelectionStore,
} from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { BoardPointerSensor } from "@/widgets/kanban-board/model/board-pointer-sensor";
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

// While dragging a column, only consider other columns as drop targets so the
// sort strategy opens a gap between columns (task cards would otherwise win the
// collision and no column preview would show). Resolve by the pointer position
// rather than the dragged rect's center — a wide column overlay would otherwise
// bias the collision to the neighbor on its right. Tasks keep the corner-based
// detection for accurate cross-column placement.
const collisionDetection: CollisionDetection = (arguments_) => {
    if (arguments_.active.data.current?.type === "column") {
        const columnContainers = arguments_.droppableContainers.filter(
            (container) => container.data.current?.type === "column"
        );
        const pointerCollisions = pointerWithin({
            ...arguments_,
            droppableContainers: columnContainers,
        });
        if (pointerCollisions.length > 0) return pointerCollisions;
    }
    return closestCorners(arguments_);
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
    const withinColumnDragEnabled = isWithinColumnDragEnabled(boardSort);
    const syncBoardSelection = useBoardTaskSelectionStore(
        (state) => state.syncBoard
    );
    const clearBoardSelection = useBoardTaskSelectionStore(
        (state) => state.clearSelection
    );
    const activeSprint = sprints.find((sprint) => sprint.state === "active");
    const createSprintId = resolveCreateTaskSprintId({
        activeSprintId: activeSprint?.id,
        boardSprintScope,
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
        useSensor(BoardPointerSensor, {
            activationConstraint: { distance: 6 },
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

    const filteredTasks = useMemo(() => {
        const scoped = filterLiveBoardTasks({
            activeSprintId: activeSprint?.id,
            scope: boardSprintScope,
            sprints,
            tasks,
        });
        return filterTasks(scoped, filters);
    }, [activeSprint?.id, boardSprintScope, filters, sprints, tasks]);

    const displayedTasks = useMemo(
        () => sortTasksByBoardSort(filteredTasks, boardSort),
        [boardSort, filteredTasks]
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
        setFilters(EMPTY_BOARD_FILTERS);
    }, [projectId]);

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

        if (activeType === "column") {
            if (!canManage) return;
            // Live preview only — persist once on drag end.
            columnsApi.reorderColumns(String(active.id), String(over.id), {
                persist: false,
            });
            return;
        }

        if (activeType !== "task") return;
        if (!canEdit) return;

        // Only move across columns here; same-column ordering is handled
        // visually by the sort strategy and committed on drop.
        const dragIds = resolveCrossColumnDragTaskIds({
            activeId: String(active.id),
            selectedIds: selectionIdsForBoard,
        });
        moveTasksToColumn(dragIds, String(over.id), {
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
            if (!over || active.id === over.id) {
                columnsApi.rollbackColumnDragGesture();
                return;
            }
            columnsApi.commitColumnDragGesture();
            return;
        }

        if (activeType !== "task") return;
        if (!canEdit) {
            rollbackTaskDragGesture();
            return;
        }

        if (!over || active.id === over.id) {
            // Cross-column preview may still need committing, or cancel.
            // If over is missing/same id after a cross-column preview, keep the
            // previewed placement and persist; pure cancel goes through onDragCancel.
            commitTaskDragGesture();
            return;
        }

        const overType = over.data.current?.type as DragType | undefined;
        const dragIds = resolveCrossColumnDragTaskIds({
            activeId: String(active.id),
            selectedIds: selectionIdsForBoard,
        });

        // Multi-select: cross-column only — skip within-column reorder for a set.
        if (
            overType === "task" &&
            withinColumnDragEnabled &&
            dragIds.length === 1
        ) {
            reorderTaskWithin(String(active.id), String(over.id), {
                persist: false,
            });
        }

        commitTaskDragGesture();
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
            <div className="sticky left-0 z-5 flex w-[calc(100cqw-6rem)] shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
                <BoardTaskFiltersBar
                    filters={filters}
                    labels={projectLabels}
                    onChange={setFilters}
                />
                <BoardSortControl
                    onChange={(sort) => {
                        setBoardSort(boardId, sort);
                    }}
                    value={boardSort}
                />
            </div>

            <DndContext
                collisionDetection={collisionDetection}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                sensors={sensors}
            >
                <SortableContext
                    items={columnIds}
                    strategy={rectSortingStrategy}
                >
                    <div className="flex min-h-0 min-w-full w-max flex-1 gap-0">
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
                                    className="justify-start gap-2 text-muted-foreground"
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
