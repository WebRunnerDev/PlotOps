import {
    closestCorners,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    horizontalListSortingStrategy,
    SortableContext,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    type BoardColumn,
    type BoardTaskFilters,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    type ProjectLabel,
    type Task,
    TaskCard,
    TaskDrawer,
    type TaskStatus,
    useTasksStore,
} from "@/features/tasks";
import { Button } from "@/shared/shadcn/ui/button";

import { KanbanColumn } from "./kanban-column";
import { KanbanFilters } from "./kanban-filters";

type DragType = "column" | "task";

type KanbanBoardProperties = {
    projectId: string;
};

export function KanbanBoard({ projectId }: KanbanBoardProperties) {
    const { t } = useTranslation("board");
    const tasks = useTasksStore((state) => state.tasks);
    const columns = useTasksStore((state) => state.columns);
    const labels = useTasksStore((state) => state.labels);
    const addColumn = useTasksStore((state) => state.addColumn);
    const ensureProjectLabels = useTasksStore(
        (state) => state.ensureProjectLabels,
    );
    const reorderColumns = useTasksStore((state) => state.reorderColumns);
    const updateTaskStatus = useTasksStore((state) => state.updateTaskStatus);
    const [activeTask, setActiveTask] = useState<Task | undefined>();
    const [activeColumn, setActiveColumn] = useState<BoardColumn | undefined>();
    const [focusColumnId, setFocusColumnId] = useState<string | undefined>();
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        }),
    );

    const columnIds = columns.map((column) => column.id);
    const columnIdSet = new Set(columnIds);

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId],
    );

    const labelsById = useMemo(() => {
        const map = new Map<string, ProjectLabel>();
        for (const label of projectLabels) {
            map.set(label.id, label);
        }
        return map;
    }, [projectLabels]);

    const filteredTasks = useMemo(
        () => filterTasks(tasks, filters),
        [filters, tasks],
    );

    const labelsByTaskId = useMemo(() => {
        const map = new Map<string, ProjectLabel[]>();
        for (const task of filteredTasks) {
            const resolved =
                task.labelIds
                    ?.map((id) => labelsById.get(id))
                    .filter(Boolean) ??
                [];
            map.set(task.id, resolved);
        }
        return map;
    }, [filteredTasks, labelsById]);

    useEffect(() => {
        ensureProjectLabels(projectId);
    }, [ensureProjectLabels, projectId]);

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
                columns.find((column) => column.id === event.active.id),
            );
            return;
        }

        if (type === "task") {
            setActiveTask(
                filteredTasks.find((item) => item.id === event.active.id),
            );
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        clearActiveDrag();
        if (!over || active.id === over.id) return;

        const activeType = active.data.current?.type as DragType | undefined;

        if (activeType === "column") {
            const overColumnId = resolveColumnId(
                String(over.id),
                over.data.current,
                filteredTasks,
                columnIdSet,
            );
            if (!overColumnId || overColumnId === active.id) return;
            reorderColumns(String(active.id), overColumnId);
            return;
        }

        if (activeType === "task") {
            const nextStatus = resolveDropStatus(
                String(over.id),
                over.data.current,
                filteredTasks,
                columnIdSet,
            );
            if (!nextStatus) return;

            const task = filteredTasks.find((item) => item.id === active.id);
            if (!task || task.status === nextStatus) return;

            updateTaskStatus(task.id, nextStatus);
        }
    };

    const handleAddColumn = () => {
        const id = addColumn(t("columns.newStatus"));
        setFocusColumnId(id);

        globalThis.requestAnimationFrame(() => {
            const node = document.querySelector(`[data-column-id="${id}"]`);
            node?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "end",
            });
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="sticky left-0 z-[5] w-[calc(100cqw-6rem)] shrink-0">
                <KanbanFilters
                    filters={filters}
                    labels={projectLabels}
                    onChange={setFilters}
                />
            </div>

            <DndContext
                collisionDetection={closestCorners}
                onDragCancel={clearActiveDrag}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                sensors={sensors}
            >
                <SortableContext
                    items={columnIds}
                    strategy={horizontalListSortingStrategy}
                >
                    <div className="flex min-h-0 min-w-full w-max flex-1 gap-3">
                        {columns.map((column) => (
                            <KanbanColumn
                                key={column.id}
                                labelsByTaskId={labelsByTaskId}
                                name={column.name}
                                startEditing={focusColumnId === column.id}
                                status={column.id}
                                tasks={filteredTasks.filter(
                                    (task) => task.status === column.id,
                                )}
                            />
                        ))}

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
                    </div>
                </SortableContext>

                {/* dnd-kit API: null disables drop animation */}
                {/* eslint-disable-next-line unicorn/no-null -- DragOverlay API */}
                <DragOverlay dropAnimation={null}>
                    {activeTask ? (
                        <div className="rotate-1 scale-[1.02] shadow-lg">
                            <TaskCard
                                labels={labelsByTaskId.get(activeTask.id) ?? []}
                                task={activeTask}
                            />
                        </div>
                    ) : undefined}
                    {activeColumn ? (
                        <div className="flex h-40 w-72 items-start rounded-xl bg-muted/80 p-3 opacity-95 shadow-lg ring-1 ring-primary/40">
                            <p className="text-ui font-medium">
                                {activeColumn.name}
                            </p>
                        </div>
                    ) : undefined}
                </DragOverlay>
            </DndContext>

            <TaskDrawer projectId={projectId} />
        </div>
    );
}

function resolveColumnId(
    overId: string,
    overData: Record<string, unknown> | undefined,
    tasks: Task[],
    columnIds: Set<string>,
): TaskStatus | undefined {
    if (overData?.type === "column") return overId;
    if (overData?.type === "task" && typeof overData.status === "string") {
        return overData.status;
    }
    if (columnIds.has(overId)) return overId;
    return tasks.find((task) => task.id === overId)?.status;
}

function resolveDropStatus(
    overId: string,
    overData: Record<string, unknown> | undefined,
    tasks: Task[],
    columnIds: Set<string>,
): TaskStatus | undefined {
    return resolveColumnId(overId, overData, tasks, columnIds);
}
