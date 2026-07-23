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
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type { Task } from "@/features/tasks";

import { useBoardColumns } from "@/features/boards";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    useBoardSprints,
    useSprintEvents,
    useSprintMutations,
} from "@/features/sprints/model/use-sprints";
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
import { useBoardTasks } from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
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

export function BacklogPage({ boardId, projectId }: BacklogPageProperties) {
    const { t } = useTranslation("board");
    const { canManageBoard } = useProjectAccess(projectId);
    const columnsApi = useBoardColumns(projectId, boardId);
    const tasksApi = useBoardTasks(projectId, boardId);
    const { columns } = columnsApi;
    const { tasks } = tasksApi;
    const error = columnsApi.error ?? tasksApi.error;
    const isLoading = columnsApi.isLoading || tasksApi.isLoading;
    const { data: sprints = [], isLoading: sprintsLoading } =
        useBoardSprints(boardId);
    const { createDraft, moveTasks } = useSprintMutations(projectId, boardId);
    const [newName, setNewName] = useState("");
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [draggingTasks, setDraggingTasks] = useState<Task[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    );

    const active = sprints.find((sprint) => sprint.state === "active");
    const drafts = sprints.filter((sprint) => sprint.state === "draft");
    const closed = sprints.filter((sprint) => sprint.state === "closed");
    const planningSprints = [...(active ? [active] : []), ...drafts];

    const backlogTasks = useMemo(
        () => sortBySprintPosition(tasks.filter((task) => !task.sprintId)),
        [tasks]
    );

    const tasksBySprint = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const sprint of planningSprints) {
            map.set(
                sprint.id,
                sortBySprintPosition(
                    tasks.filter((task) => task.sprintId === sprint.id)
                )
            );
        }
        return map;
    }, [planningSprints, tasks]);

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
        const uniqueIds = [...new Set(taskIds)];
        if (uniqueIds.length === 0) return;

        const siblings = targetSprintId
            ? (tasksBySprint.get(targetSprintId) ?? [])
            : backlogTasks;
        const siblingIds = new Set(siblings.map((task) => task.id));
        const movingIds = uniqueIds.filter((id) => {
            const task = tasks.find((item) => item.id === id);
            if (!task) return false;
            const current = task.sprintId ?? null;
            return current !== targetSprintId;
        });

        if (movingIds.length === 0) return;

        let maxPosition = -1;
        for (const task of siblings) {
            if (siblingIds.has(task.id) && !movingIds.includes(task.id)) {
                maxPosition = Math.max(maxPosition, task.sprintPosition ?? -1);
            }
        }

        const updates = movingIds.map((taskId, index) => ({
            sprintId: targetSprintId,
            sprintPosition: maxPosition + 1 + index,
            taskId,
        }));

        try {
            await moveTasks.mutateAsync(updates);
            setRowSelection((previous) => {
                const next = { ...previous };
                for (const id of movingIds) {
                    delete next[id];
                }
                return next;
            });
        } catch {
            toast.error(
                movingIds.length > 1
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

    const handleBulkMove = (targetValue: string) => {
        const selectedIds = Object.keys(rowSelection).filter(
            (id) => rowSelection[id]
        );
        void handleMoveMany(
            selectedIds,
            targetValue === "backlog" ? null : targetValue
        );
    };

    if (isLoading || sprintsLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{t("projectError")}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 pb-24">
            <header className="flex flex-wrap items-center gap-2">
                <Button
                    className="text-muted-foreground"
                    nativeButton={false}
                    render={
                        <Link
                            params={{ boardId, projectId }}
                            to="/projects/$projectId/boards/$boardId"
                        />
                    }
                    size="sm"
                    variant="ghost"
                >
                    <ArrowLeft data-icon="inline-start" />
                    {t("sprints.backToBoard")}
                </Button>
                <h1 className="text-h1">{t("sprints.backlogTitle")}</h1>
            </header>

            {canManageBoard ? (
                <div className="flex flex-wrap gap-2">
                    <Input
                        className="max-w-xs"
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

            {canManageBoard && planningSprints.length === 0 ? (
                <Alert>
                    <AlertDescription>
                        {t("sprints.emptyPlanningHint")}
                    </AlertDescription>
                </Alert>
            ) : null}

            {canManageBoard && selectedCount === 0 ? (
                <p className="text-meta text-muted-foreground">
                    {t("sprints.selectToDragHint")}
                </p>
            ) : null}

            {canManageBoard && selectedCount > 0 ? (
                <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
                    <p className="text-ui">
                        {t("sprints.selectedCount", { count: selectedCount })}
                    </p>
                    <p className="text-meta text-muted-foreground">
                        {t("sprints.dragSelectedHint")}
                    </p>
                    <select
                        aria-label={t("sprints.moveSelected")}
                        className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-ui"
                        defaultValue=""
                        disabled={moveTasks.isPending}
                        key={selectedCount}
                        onChange={(event) => {
                            const value = event.target.value;
                            if (!value) return;
                            handleBulkMove(value);
                        }}
                    >
                        <option disabled value="">
                            {t("sprints.moveSelectedPlaceholder")}
                        </option>
                        {moveTargets.map((target) => (
                            <option
                                key={target.id ?? "backlog"}
                                value={target.id ?? "backlog"}
                            >
                                {target.label}
                            </option>
                        ))}
                    </select>
                    <Button
                        onClick={() => setRowSelection({})}
                        size="xs"
                        type="button"
                        variant="ghost"
                    >
                        {t("sprints.clearSelection")}
                    </Button>
                </div>
            ) : null}

            <DndContext
                collisionDetection={backlogCollisionDetection}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                sensors={sensors}
            >
                <div className="flex flex-col gap-4">
                    {planningSprints.map((sprint) => (
                        <SprintSection
                            activeSprint={active}
                            boardId={boardId}
                            canManage={canManageBoard}
                            columns={columns}
                            drafts={drafts}
                            draggingTaskIds={draggingTasks.map(
                                (task) => task.id
                            )}
                            key={sprint.id}
                            onRowSelectionChange={setRowSelection}
                            projectId={projectId}
                            rowSelection={rowSelection}
                            sprint={sprint}
                            tasks={tasksBySprint.get(sprint.id) ?? []}
                        />
                    ))}

                    <section className="rounded-md border border-border">
                        <header className="border-b border-border px-3 py-2">
                            <h2 className="text-h3">{t("sprints.backlog")}</h2>
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.taskCount", {
                                    count: backlogTasks.length,
                                })}
                            </p>
                        </header>
                        <SprintTaskTable
                            canManage={canManageBoard}
                            containerId={BACKLOG_DROP_ID}
                            draggingTaskIds={draggingTasks.map(
                                (task) => task.id
                            )}
                            onRowSelectionChange={setRowSelection}
                            rowSelection={rowSelection}
                            tasks={backlogTasks}
                        />
                    </section>

                    {closed.length > 0 ? (
                        <section className="space-y-3">
                            <h2 className="text-h3">
                                {t("sprints.closedList")}
                            </h2>
                            {closed.map((sprint) => (
                                <SprintSection
                                    activeSprint={active}
                                    boardId={boardId}
                                    canManage={canManageBoard}
                                    columns={columns}
                                    drafts={drafts}
                                    draggingTaskIds={[]}
                                    key={sprint.id}
                                    onRowSelectionChange={() => {}}
                                    projectId={projectId}
                                    rowSelection={{}}
                                    sprint={sprint}
                                    tasks={[]}
                                />
                            ))}
                        </section>
                    ) : null}
                </div>

                <DragOverlay dropAnimation={null}>
                    {draggingTasks.length > 0 ? (
                        <div className="flex w-72 max-w-[min(18rem,calc(100vw-2rem))] cursor-grabbing flex-col gap-1 rounded-md border border-border bg-background px-3 py-2.5 shadow-lg ring-1 ring-primary/20">
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

function SprintReportPanel({ sprint }: { sprint: Sprint }) {
    const { t } = useTranslation("board");
    const { data: events = [], isLoading } = useSprintEvents(sprint.id);
    const committed = sprint.committedTaskIds.length;
    const completed = sprint.completedTaskIds.length;
    const scopeAdds = events.filter(
        (event) => event.eventType === "task_added"
    ).length;
    const scopeRemoves = events.filter(
        (event) => event.eventType === "task_removed"
    ).length;

    return (
        <div className="space-y-2 border-t border-border px-3 py-3">
            <p className="text-ui">
                {t("sprints.reportSummary", { committed, completed })}
            </p>
            <p className="text-ui text-muted-foreground">
                {t("sprints.reportScope", {
                    added: scopeAdds,
                    removed: scopeRemoves,
                })}
            </p>
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
    boardId,
    canManage,
    columns,
    drafts,
    draggingTaskIds,
    onRowSelectionChange,
    projectId,
    rowSelection,
    sprint,
    tasks,
}: {
    activeSprint?: Sprint;
    boardId: string;
    canManage: boolean;
    columns: Array<{ id: string }>;
    drafts: Sprint[];
    draggingTaskIds: string[];
    onRowSelectionChange: OnChangeFn<RowSelectionState>;
    projectId: string;
    rowSelection: RowSelectionState;
    sprint: Sprint;
    tasks: Task[];
}) {
    const { t } = useTranslation("board");
    const { removeDraft } = useSprintMutations(projectId, boardId);
    const [startOpen, setStartOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    const isPlanning = sprint.state === "draft" || sprint.state === "active";

    return (
        <section className="rounded-md border border-border">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-h3">{sprint.name}</h2>
                        <span className="text-meta text-muted-foreground">
                            {t(`sprints.state.${sprint.state}`)}
                        </span>
                        <span className="text-meta text-muted-foreground">
                            {t("sprints.taskCount", { count: tasks.length })}
                        </span>
                    </div>
                    {sprint.goal ? (
                        <p className="text-ui text-muted-foreground">
                            {sprint.goal}
                        </p>
                    ) : null}
                    {sprint.startsOn && sprint.endsOn ? (
                        <p className="text-code text-muted-foreground">
                            {sprint.startsOn} → {sprint.endsOn}
                        </p>
                    ) : null}
                </div>
                {canManage && sprint.state === "draft" ? (
                    <>
                        <Button
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
                        <Button
                            disabled={tasks.length > 0}
                            onClick={() => {
                                void removeDraft
                                    .mutateAsync(sprint.id)
                                    .then(() =>
                                        toast.success(t("sprints.draftDeleted"))
                                    )
                                    .catch(() =>
                                        toast.error(
                                            t("sprints.draftDeleteFailed")
                                        )
                                    );
                            }}
                            size="xs"
                            type="button"
                            variant="ghost"
                        >
                            {t("sprints.deleteDraft")}
                        </Button>
                    </>
                ) : null}
                {canManage && sprint.state === "active" ? (
                    <>
                        <Button
                            onClick={() => setCloseOpen(true)}
                            size="xs"
                            type="button"
                        >
                            {t("sprints.close")}
                        </Button>
                        <Button
                            onClick={() => setCancelOpen(true)}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {t("sprints.cancel")}
                        </Button>
                    </>
                ) : null}
                {canManage && sprint.state === "draft" ? (
                    <Button
                        onClick={() => setCancelOpen(true)}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        {t("sprints.cancel")}
                    </Button>
                ) : null}
                {sprint.state === "closed" ? (
                    <Button
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
            </header>

            {isPlanning ? (
                <SprintTaskTable
                    canManage={canManage}
                    containerId={sprintDropId(sprint.id)}
                    draggingTaskIds={draggingTaskIds}
                    onRowSelectionChange={onRowSelectionChange}
                    rowSelection={rowSelection}
                    tasks={tasks}
                />
            ) : null}

            {reportOpen && sprint.state === "closed" ? (
                <SprintReportPanel sprint={sprint} />
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
        </section>
    );
}
