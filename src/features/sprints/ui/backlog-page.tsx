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
import {
    ArrowLeft,
    ChevronDown,
    MoreHorizontal,
    Play,
    Plus,
    Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Sprint } from "@/features/sprints/model/types";
import type { BoardTaskFilters, Task } from "@/features/tasks";

import { useAuth } from "@/features/auth/model/use-auth";
import { BoardSwitcher, useBoardColumns } from "@/features/boards";
import { useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
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
import {
    BoardTaskFiltersBar,
    EMPTY_BOARD_FILTERS,
    filterTasks,
    isBoardFiltersActive,
    TaskDrawer,
    useBoardTasks,
    useTasksUiStore,
} from "@/features/tasks";
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

export function BacklogPage({ boardId, projectId }: BacklogPageProperties) {
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { canManageBoard } = useProjectAccess(projectId);
    const { data: project } = useProject(projectId);
    const { labels } = useProjectLabels(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
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
        isBoardFiltersActive(filters) || searchQuery.trim().length > 0;

    const visibleTasks = useMemo(() => {
        const filtered = filterTasks(tasks, filters);
        const query = searchQuery.trim().toLowerCase();
        if (!query) return filtered;
        return filtered.filter(
            (task) =>
                task.key.toLowerCase().includes(query) ||
                task.title.toLowerCase().includes(query)
        );
    }, [filters, searchQuery, tasks]);

    const backlogTasks = useMemo(
        () =>
            sortBySprintPosition(visibleTasks.filter((task) => !task.sprintId)),
        [visibleTasks]
    );

    const tasksBySprint = useMemo(() => {
        const map = new Map<string, Task[]>();
        for (const sprint of planningSprints) {
            map.set(
                sprint.id,
                sortBySprintPosition(
                    visibleTasks.filter((task) => task.sprintId === sprint.id)
                )
            );
        }
        return map;
    }, [planningSprints, visibleTasks]);

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

        const targetSiblings = targetSprintId
            ? tasks.filter((task) => task.sprintId === targetSprintId)
            : tasks.filter((task) => !task.sprintId);
        const movingIds = uniqueIds.filter((id) => {
            const task = tasks.find((item) => item.id === id);
            if (!task) return false;
            const current = task.sprintId ?? null;
            return current !== targetSprintId;
        });

        if (movingIds.length === 0) return;

        let maxPosition = -1;
        for (const task of targetSiblings) {
            if (!movingIds.includes(task.id)) {
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
            setBulkMoveValue(undefined);
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

    if (error) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
                <Button
                    className="w-fit text-muted-foreground"
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
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const showBodySpinner = isLoading || sprintsLoading;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                            className="shrink-0 text-muted-foreground"
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
                        <h1 className="truncate text-sm font-semibold">
                            {t("sprints.backlogTitle")}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <BoardSwitcher
                            boardId={boardId}
                            canManage={canManageBoard}
                            defaultBaseBranch={
                                project?.github_default_branch ?? "main"
                            }
                            destination="backlog"
                            projectId={projectId}
                        />
                    </div>
                </div>

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

                <div className="flex flex-col gap-2">
                    <div className="relative max-w-sm">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            className="pl-8"
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            placeholder={t("sprints.searchPlaceholder")}
                            value={searchQuery}
                        />
                    </div>
                    <BoardTaskFiltersBar
                        filters={filters}
                        labels={projectLabels}
                        onChange={setFilters}
                    />
                </div>
            </header>

            {showBodySpinner ? (
                <div className="flex h-40 items-center justify-center">
                    <Spinner />
                </div>
            ) : (
                <>
                    {canManageBoard && planningSprints.length === 0 ? (
                        <Alert>
                            <AlertDescription>
                                {t("sprints.emptyPlanningHint")}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {filtersActive && visibleTasks.length === 0 ? (
                        <div className="flex flex-col items-start gap-2 rounded-md border border-border px-4 py-6">
                            <p className="text-ui text-muted-foreground">
                                {t("sprints.noFilterMatches")}
                            </p>
                            <Button
                                onClick={clearFilters}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {t("sprints.clearFilters")}
                            </Button>
                        </div>
                    ) : null}

                    {canManageBoard && selectedCount > 0 ? (
                        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
                            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 shadow-lg ring-1 ring-foreground/5 backdrop-blur">
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
                                        className="min-w-44"
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
                            </div>
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
                                        labels={projectLabels}
                                        onOpenTask={selectTask}
                                        onRowSelectionChange={setRowSelection}
                                        projectId={projectId}
                                        rowSelection={rowSelection}
                                        sprint={sprint}
                                        tasks={
                                            tasksBySprint.get(sprint.id) ?? []
                                        }
                                    />
                                ))}

                                <section className="rounded-md border border-border bg-card">
                                    <header className="border-b border-border px-3 py-2">
                                        <h2 className="text-h3">
                                            {t("sprints.backlog")}
                                        </h2>
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
                                        labels={projectLabels}
                                        onOpenTask={selectTask}
                                        onRowSelectionChange={setRowSelection}
                                        rowSelection={rowSelection}
                                        tasks={backlogTasks}
                                    />
                                </section>

                                {pastSprints.length > 0 ? (
                                    <section className="space-y-3">
                                        <button
                                            className="flex items-center gap-1.5 text-h3"
                                            onClick={() =>
                                                setHistoryOpen(
                                                    (value) => !value
                                                )
                                            }
                                            type="button"
                                        >
                                            <ChevronDown
                                                aria-hidden
                                                className={`size-4 transition-transform ${historyOpen ? "" : "-rotate-90"}`}
                                            />
                                            {t("sprints.historyList")}
                                            <span className="text-meta font-normal text-muted-foreground">
                                                ({pastSprints.length})
                                            </span>
                                        </button>
                                        {historyOpen
                                            ? pastSprints.map((sprint) => (
                                                  <PastSprintSection
                                                      boardId={boardId}
                                                      canManage={canManageBoard}
                                                      key={sprint.id}
                                                      projectId={projectId}
                                                      sprint={sprint}
                                                  />
                                              ))
                                            : null}
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

                    <TaskDrawer
                        boardId={boardId}
                        githubToken={githubAccessToken}
                        projectId={projectId}
                        repoFullName={project?.github_full_name}
                    />
                </>
            )}
        </div>
    );
}

function PastSprintSection({
    boardId,
    canManage,
    projectId,
    sprint,
}: {
    boardId: string;
    canManage: boolean;
    projectId: string;
    sprint: Sprint;
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
        <section className="rounded-md border border-border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-h3">{sprint.name}</h2>
                        <span className="text-meta text-muted-foreground">
                            {t(`sprints.state.${sprint.state}`)}
                        </span>
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
            {reportOpen ? <SprintReportPanel sprint={sprint} /> : null}

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
        </section>
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
    const isCanceled = sprint.state === "canceled";

    return (
        <div className="space-y-2 border-t border-border px-3 py-3">
            {isCanceled ? (
                <p className="text-ui text-muted-foreground">
                    {t("sprints.canceledSummary")}
                </p>
            ) : (
                <p className="text-ui">
                    {t("sprints.reportSummary", { committed, completed })}
                </p>
            )}
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
    labels,
    onOpenTask,
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
    labels: Parameters<typeof SprintTaskTable>[0]["labels"];
    onOpenTask: (taskId: string) => void;
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

    return (
        <section className="rounded-md border border-border bg-card">
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
                ) : null}
                {canManage && sprint.state === "active" ? (
                    <Button
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
                            {sprint.state === "draft" && tasks.length === 0 ? (
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
                            (sprint.state === "draft" && tasks.length > 0) ? (
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

            <SprintTaskTable
                canManage={canManage}
                containerId={sprintDropId(sprint.id)}
                draggingTaskIds={draggingTaskIds}
                labels={labels}
                onOpenTask={onOpenTask}
                onRowSelectionChange={onRowSelectionChange}
                rowSelection={rowSelection}
                tasks={tasks}
            />

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
