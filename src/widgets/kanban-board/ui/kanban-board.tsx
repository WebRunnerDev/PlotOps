import {
    closestCenter,
    closestCorners,
    type CollisionDetection,
    defaultDropAnimationSideEffects,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type DropAnimation,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    type BoardColumn,
    type BoardTaskFilters,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    type ProjectLabel,
    type Task,
    TaskCard,
    TaskDrawer,
} from "@/features/tasks";
import { useBoardContext } from "@/features/tasks/model/board-context";
import { useBoardSprints } from "@/features/tasks/model/use-sprints";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";

import { BoardLoading } from "./board-loading";
import { KanbanColumn } from "./kanban-column";
import { KanbanFilters } from "./kanban-filters";

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
        return closestCenter({
            ...arguments_,
            droppableContainers: columnContainers,
        });
    }
    return closestCorners(arguments_);
};

type KanbanBoardProperties = {
    githubToken: null | string;
    projectId: string;
    repoFullName: string | undefined;
};

export function KanbanBoard({
    githubToken,
    projectId,
    repoFullName,
}: KanbanBoardProperties) {
    const { t } = useTranslation("board");
    const {
        addColumn,
        boardId,
        columns,
        error,
        isLoading,
        labels,
        moveTaskToColumn,
        reorderColumns,
        reorderTaskWithin,
        tasks,
    } = useBoardContext();
    const { canManageBoard } = useProjectAccess(projectId);
    const { data: sprints = [] } = useBoardSprints(boardId);
    const boardSprintScope = useTasksUiStore((state) => state.boardSprintScope);
    const activeSprint = sprints.find((sprint) => sprint.state === "active");
    const [activeTask, setActiveTask] = useState<Task | undefined>();
    const [activeColumn, setActiveColumn] = useState<BoardColumn | undefined>();
    const [focusColumnId, setFocusColumnId] = useState<string | undefined>();
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    );

    const columnIds = columns.map((column) => column.id);

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
        const scoped =
            boardSprintScope === "active" && activeSprint
                ? tasks.filter((task) => task.sprintId === activeSprint.id)
                : tasks;
        return filterTasks(scoped, filters);
    }, [activeSprint, boardSprintScope, filters, tasks]);

    const labelsByTaskId = useMemo(() => {
        const map = new Map<string, ProjectLabel[]>();
        for (const task of filteredTasks) {
            const resolved =
                task.labelIds
                    ?.map((id) => labelsById.get(id))
                    .filter(
                        (label): label is ProjectLabel => label !== undefined
                    ) ?? [];
            map.set(task.id, resolved);
        }
        return map;
    }, [filteredTasks, labelsById]);

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

    const clearActiveDrag = () => {
        setActiveTask(undefined);
        setActiveColumn(undefined);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const type = event.active.data.current?.type as DragType | undefined;

        if (type === "column") {
            setActiveColumn(
                columns.find((column) => column.id === event.active.id)
            );
            return;
        }

        if (type === "task") {
            setActiveTask(
                filteredTasks.find((item) => item.id === event.active.id)
            );
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as DragType | undefined;

        if (activeType === "column") {
            // Live reorder so the column physically slots into place, showing
            // exactly where it lands (like a task). Collision is pointer-based
            // and restricted to columns, so `over` is always a column and this
            // stays stable (no oscillation).
            reorderColumns(String(active.id), String(over.id));
            return;
        }

        if (activeType !== "task") return;

        // Only move across columns here; same-column ordering is handled
        // visually by the sort strategy and committed on drop.
        moveTaskToColumn(String(active.id), String(over.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        clearActiveDrag();
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as DragType | undefined;

        // Column order is applied live in onDragOver; nothing to commit here.
        if (activeType === "column") return;

        if (activeType === "task") {
            const overType = over.data.current?.type as DragType | undefined;
            // Cross-column placement already happened in onDragOver; here we
            // only commit the final in-column position when dropped over a task.
            if (overType === "task") {
                reorderTaskWithin(String(active.id), String(over.id));
            }
        }
    };

    const handleAddColumn = () => {
        void addColumn(t("columns.newStatus")).then((id) => {
            setFocusColumnId(id);

            globalThis.requestAnimationFrame(() => {
                const node = document.querySelector(`[data-column-id="${id}"]`);
                node?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "end",
                });
            });
        });
    };

    if (isLoading) {
        return <BoardLoading variant="columns" />;
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{t("projectError")}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="sticky left-0 z-5 w-[calc(100cqw-6rem)] shrink-0">
                <KanbanFilters
                    filters={filters}
                    labels={projectLabels}
                    onChange={setFilters}
                />
            </div>

            <DndContext
                collisionDetection={collisionDetection}
                onDragCancel={clearActiveDrag}
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
                                key={column.id}
                                labelsByTaskId={labelsByTaskId}
                                name={column.name}
                                startEditing={focusColumnId === column.id}
                                status={column.id}
                                tasks={filteredTasks.filter(
                                    (task) => task.status === column.id
                                )}
                            />
                        ))}

                        {canManageBoard ? (
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
                        <div className="rotate-2 scale-[1.03] cursor-grabbing shadow-2xl shadow-primary/20 duration-150 ease-out animate-in zoom-in-95">
                            <TaskCard
                                labels={labelsByTaskId.get(activeTask.id) ?? []}
                                task={activeTask}
                            />
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
                githubToken={githubToken}
                projectId={projectId}
                repoFullName={repoFullName}
            />
        </div>
    );
}
