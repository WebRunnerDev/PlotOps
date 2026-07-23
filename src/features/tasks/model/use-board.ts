import type { RealtimeChannel } from "@supabase/supabase-js";

import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

import type { ProjectBoardRecord } from "@/features/boards/model/types";
import type {
    BoardColumn,
    Task,
    TaskActivityChange,
    TaskPullRequest,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { boardKeys } from "@/features/boards/model/query-keys";
import { useBoardColumns } from "@/features/boards/model/use-board-columns";
import { resolveLabelNames } from "@/features/labels/model/resolve-label-names";
import { useProjectLabels } from "@/features/labels/model/use-project-labels";
import { insertTaskActivityEvent } from "@/features/tasks/api/task-activity-api";
import {
    archiveTaskRecord,
    createTaskRecord,
    deleteTaskRecord,
    fetchBoardTasks,
    moveTaskToBoard,
    persistTaskMoves,
    type ProjectBoard,
    replaceTaskLabels,
    restoreTaskRecord,
    updateTaskRecord,
} from "@/features/tasks/api/tasks-api";
import {
    applyDetailsToSnapshot,
    buildTaskActivityChanges,
    toTaskActivitySnapshot,
} from "@/features/tasks/lib/build-task-activity-changes";
import {
    composeProjectBoard,
    getBoardSnapshot,
    invalidateBoardWorkspace,
    invalidateBoardWorkspaceSlice,
    setBoardSnapshot,
} from "@/features/tasks/model/board-query-cache";
import { taskKeys } from "@/features/tasks/model/query-keys";
import { activityKey } from "@/features/tasks/model/use-task-activity";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple `useBoard` mounts share one `tasks` subscription. */
const taskChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

type TaskDetailsUpdate = Partial<
    Omit<Task, "assignee" | "author" | "branchName" | "id" | "pr" | "status">
> & {
    /** Pass `null` to clear assignee or author. */
    assignee?: null | Task["assignee"];
    author?: null | Task["author"];
    /** Pass `null` to clear a linked branch. */
    branchName?: null | string;
    /** Pass `null` to clear a linked pull request. */
    pr?: null | TaskPullRequest;
};

type TaskMoveUpdate = {
    id: string;
    position: number;
    status: TaskStatus;
};

export function useBoard(projectId: string, boardId: string) {
    const queryClient = useQueryClient();
    const labelsApi = useProjectLabels(projectId);
    const columnsApi = useBoardColumns(projectId, boardId);

    const tasksQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => fetchBoardTasks(boardId),
        queryKey: taskKeys.board(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId) return;

        return subscribeTasksChannel(projectId, () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        });
    }, [projectId, queryClient]);

    const moveTaskMutation = useMutation({
        mutationFn: async ({
            activity,
            updates,
        }: {
            activity?: {
                changes: TaskActivityChange[];
                taskId: string;
            };
            updates: TaskMoveUpdate[];
        }) => {
            await persistTaskMoves(boardId, updates);
            if (activity) {
                await recordTaskActivity({
                    changes: activity.changes,
                    projectId,
                    queryClient,
                    taskId: activity.taskId,
                });
            }
        },
        onSettled: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        },
    });

    const updateTaskDetailsMutation = useMutation({
        mutationFn: async ({
            activityChanges,
            details,
            id,
        }: {
            activityChanges: TaskActivityChange[];
            details: TaskDetailsUpdate;
            id: string;
        }) => {
            const patch: Parameters<typeof updateTaskRecord>[1] = {};
            if (details.title !== undefined) patch.title = details.title;
            if (details.description !== undefined) {
                patch.description = details.description ?? null;
            }
            if (details.priority !== undefined) {
                patch.priority = details.priority ?? null;
            }
            if (details.deadline !== undefined) {
                patch.deadline = details.deadline ?? null;
            }
            if (details.branchName !== undefined) {
                patch.branch_name = details.branchName ?? null;
            }
            if (details.pr !== undefined) {
                if (details.pr === null) {
                    patch.pr_number = null;
                    patch.pr_state = null;
                    patch.pr_url = null;
                } else {
                    patch.pr_number = details.pr.number;
                    patch.pr_state = details.pr.state;
                    patch.pr_url = details.pr.url;
                }
            }
            if (details.type !== undefined) {
                patch.task_type = details.type;
            }
            if (details.assignee !== undefined) {
                patch.assignee_id = details.assignee?.id ?? null;
            }
            if (details.author !== undefined) {
                patch.author_id = details.author?.id ?? null;
            }

            await updateTaskRecord(id, patch);

            if (details.labelIds !== undefined) {
                await replaceTaskLabels(id, details.labelIds ?? []);
            }

            await recordTaskActivity({
                changes: activityChanges,
                projectId,
                queryClient,
                taskId: id,
            });
        },
        onSettled: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        },
    });

    const updateTaskStatusMutation = useMutation({
        mutationFn: async ({
            activityChanges,
            id,
            status,
        }: {
            activityChanges: TaskActivityChange[];
            id: string;
            status: TaskStatus;
        }) => {
            await updateTaskRecord(id, { status });
            await recordTaskActivity({
                changes: activityChanges,
                projectId,
                queryClient,
                taskId: id,
            });
        },
        onSettled: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        },
    });

    const moveTaskToBoardMutation = useMutation({
        mutationFn: async ({
            activityChanges,
            targetBoardId,
            targetStatus,
            taskId,
        }: {
            activityChanges: TaskActivityChange[];
            targetBoardId: string;
            targetStatus: TaskStatus;
            taskId: string;
        }) => {
            await moveTaskToBoard(taskId, targetBoardId, targetStatus);
            await recordTaskActivity({
                changes: activityChanges,
                projectId,
                queryClient,
                taskId,
            });
        },
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: boardKeys.list(projectId),
            });
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: ({
            status,
            taskType,
            title,
        }: {
            status: TaskStatus;
            taskType?: TaskType;
            title: string;
        }) => createTaskRecord(projectId, boardId, status, title, taskType),
        onSuccess: (task) => {
            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...current,
                taskPositions: new Map([
                    ...current.taskPositions,
                    [task.id, current.taskPositions.get(task.id) ?? 0],
                ]),
                tasks: [...current.tasks, task],
            }));
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (taskId: string) => deleteTaskRecord(taskId),
        onError: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
    });

    const archiveTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            await archiveTaskRecord(taskId);
            const { error } = await insertTaskActivityEvent({
                action: "updated",
                changes: [{ field: "archived", from: false, to: true }],
                projectId,
                taskId,
            });
            if (error) throw error;
        },
        onError: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: (_data, _error, taskId) => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
            void queryClient.invalidateQueries({
                queryKey: activityKey(taskId),
            });
        },
    });

    const restoreTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            await restoreTaskRecord(taskId, boardId);
            const { error } = await insertTaskActivityEvent({
                action: "updated",
                changes: [{ field: "archived", from: true, to: false }],
                projectId,
                taskId,
            });
            if (error) throw error;
        },
        onError: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: (_data, _error, taskId) => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
            void queryClient.invalidateQueries({
                queryKey: activityKey(taskId),
            });
        },
    });

    const board =
        columnsApi.columnsReady && tasksQuery.data && !labelsApi.isLoading
            ? composeProjectBoard(
                  columnsApi.columns,
                  labelsApi.labels,
                  tasksQuery.data
              )
            : undefined;

    return {
        addColumn: columnsApi.addColumn,
        addLabel: labelsApi.addLabel,
        archiveTask: async (taskId: string) => {
            setBoardSnapshot(queryClient, projectId, boardId, (current) => {
                const nextPositions = new Map(current.taskPositions);
                nextPositions.delete(taskId);
                return {
                    ...current,
                    taskPositions: nextPositions,
                    tasks: current.tasks.filter((task) => task.id !== taskId),
                };
            });
            await archiveTaskMutation.mutateAsync(taskId);
        },
        boardId,
        columns: board?.columns ?? columnsApi.columns,
        copyLabelToProject: labelsApi.copyLabelToProject,
        createTask: (status: TaskStatus, title: string, taskType?: TaskType) =>
            createTaskMutation.mutateAsync({ status, taskType, title }),
        deleteColumn: async (
            columnId: TaskStatus,
            moveTasksTo?: TaskStatus
        ) => {
            const deleted = await columnsApi.deleteColumn(
                columnId,
                moveTasksTo
            );
            if (deleted && moveTasksTo) {
                invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
                void queryClient.invalidateQueries({
                    queryKey: taskKeys.archived(projectId, boardId),
                });
            }
            return deleted;
        },
        deleteLabel: labelsApi.deleteLabel,
        deleteTask: async (taskId: string) => {
            setBoardSnapshot(queryClient, projectId, boardId, (current) => {
                const nextPositions = new Map(current.taskPositions);
                nextPositions.delete(taskId);
                return {
                    ...current,
                    taskPositions: nextPositions,
                    tasks: current.tasks.filter((task) => task.id !== taskId),
                };
            });
            void queryClient.setQueryData<Task[]>(
                taskKeys.archived(projectId, boardId),
                (current) =>
                    current?.filter((task) => task.id !== taskId) ?? current
            );
            await deleteTaskMutation.mutateAsync(taskId);
        },
        error: columnsApi.error ?? labelsApi.error ?? tasksQuery.error ?? null,
        isLoading:
            columnsApi.isLoading || labelsApi.isLoading || tasksQuery.isLoading,
        labels: labelsApi.labels,
        moveLabelToProject: labelsApi.moveLabelToProject,
        moveTaskToColumn: (activeId: string, overId: string) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            if (!snapshot) return;

            const result = moveTaskToColumnInMemory(
                snapshot.tasks,
                snapshot.columns,
                activeId,
                overId
            );
            if (!result) return;

            const previous = snapshot.tasks.find(
                (task) => task.id === activeId
            );
            const next = result.tasks.find((task) => task.id === activeId);
            let activity:
                undefined | { changes: TaskActivityChange[]; taskId: string };
            if (previous && next && previous.status !== next.status) {
                const before = toTaskActivitySnapshot(previous, {
                    labelNames: resolveLabelNames(
                        snapshot.labels,
                        previous.labelIds
                    ),
                    statusName: resolveStatusName(
                        snapshot.columns,
                        previous.status
                    ),
                });
                const after = {
                    ...before,
                    status: {
                        id: next.status,
                        name: resolveStatusName(snapshot.columns, next.status),
                    },
                };
                activity = {
                    changes: buildTaskActivityChanges(before, after),
                    taskId: activeId,
                };
            }

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...applyTaskUpdates(current, result.updates),
                tasks: result.tasks,
            }));
            moveTaskMutation.mutate({ activity, updates: result.updates });
        },
        moveTaskToOtherBoard: async (
            taskId: string,
            targetBoardId: string,
            targetStatus: TaskStatus
        ) => {
            const task = board?.tasks.find((item) => item.id === taskId);
            if (!task || targetBoardId === boardId) return;

            const boards = queryClient.getQueryData<ProjectBoardRecord[]>(
                boardKeys.list(projectId)
            );
            const before = toTaskActivitySnapshot(task, {
                board: {
                    id: boardId,
                    name: resolveBoardName(boards, boardId),
                },
                labelNames: resolveLabelNames(
                    board?.labels ?? [],
                    task.labelIds
                ),
                statusName: resolveStatusName(
                    board?.columns ?? [],
                    task.status
                ),
            });
            const after = {
                ...before,
                board: {
                    id: targetBoardId,
                    name: resolveBoardName(boards, targetBoardId),
                },
                status: {
                    id: targetStatus,
                    name: targetStatus,
                },
            };

            await moveTaskToBoardMutation.mutateAsync({
                activityChanges: buildTaskActivityChanges(before, after),
                targetBoardId,
                targetStatus,
                taskId,
            });
        },
        projectId,
        renameColumn: columnsApi.renameColumn,
        renameLabel: labelsApi.renameLabel,
        reorderColumns: columnsApi.reorderColumns,
        reorderTaskWithin: (activeId: string, overId: string) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            if (!snapshot) return;

            const result = reorderTasksInMemory(
                snapshot.tasks,
                activeId,
                overId
            );
            if (!result) return;

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...applyTaskUpdates(current, result.updates),
                tasks: result.tasks,
            }));
            // Position-only reorders are intentionally not logged (SPEC).
            moveTaskMutation.mutate({ updates: result.updates });
        },
        restoreTask: async (taskId: string) => {
            await restoreTaskMutation.mutateAsync(taskId);
        },
        setLabelCustomColor: labelsApi.setLabelCustomColor,
        tasks: board?.tasks ?? [],
        updateLabelColor: labelsApi.updateLabelColor,
        updateTaskDetails: (id: string, details: TaskDetailsUpdate) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            const previous = snapshot?.tasks.find((task) => task.id === id);
            let activityChanges: TaskActivityChange[] = [];

            if (previous && snapshot) {
                const before = toTaskActivitySnapshot(previous, {
                    labelNames: resolveLabelNames(
                        snapshot.labels,
                        previous.labelIds
                    ),
                    statusName: resolveStatusName(
                        snapshot.columns,
                        previous.status
                    ),
                });
                const after = applyDetailsToSnapshot(before, {
                    assignee: details.assignee,
                    branchName: details.branchName,
                    deadline: details.deadline,
                    labelNames:
                        details.labelIds === undefined
                            ? undefined
                            : resolveLabelNames(
                                  snapshot.labels,
                                  details.labelIds ?? []
                              ),
                    pr: details.pr,
                    priority: details.priority,
                    title: details.title,
                    type: details.type,
                });
                activityChanges = buildTaskActivityChanges(before, after);
            }

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) => {
                    if (task.id !== id) return task;
                    const {
                        assignee: nextAssignee,
                        author: nextAuthor,
                        branchName: nextBranch,
                        pr: nextPr,
                        ...rest
                    } = details;
                    return {
                        ...task,
                        ...rest,
                        ...(nextAssignee === undefined
                            ? {}
                            : { assignee: nextAssignee ?? undefined }),
                        ...(nextAuthor === undefined
                            ? {}
                            : { author: nextAuthor ?? undefined }),
                        ...(nextBranch === undefined
                            ? {}
                            : { branchName: nextBranch ?? undefined }),
                        ...(nextPr === undefined
                            ? {}
                            : { pr: nextPr ?? undefined }),
                    };
                }),
            }));
            updateTaskDetailsMutation.mutate({ activityChanges, details, id });
        },
        updateTaskStatus: (id: string, status: TaskStatus) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            const previous = snapshot?.tasks.find((task) => task.id === id);
            let activityChanges: TaskActivityChange[] = [];

            if (previous && snapshot && previous.status !== status) {
                const before = toTaskActivitySnapshot(previous, {
                    labelNames: resolveLabelNames(
                        snapshot.labels,
                        previous.labelIds
                    ),
                    statusName: resolveStatusName(
                        snapshot.columns,
                        previous.status
                    ),
                });
                const after = {
                    ...before,
                    status: {
                        id: status,
                        name: resolveStatusName(snapshot.columns, status),
                    },
                };
                activityChanges = buildTaskActivityChanges(before, after);
            }

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, status } : task
                ),
            }));
            updateTaskStatusMutation.mutate({ activityChanges, id, status });
        },
    };
}

function applyTaskUpdates(
    board: ProjectBoard,
    updates: TaskMoveUpdate[]
): ProjectBoard {
    const statusById = new Map(
        updates.map((update) => [update.id, update.status])
    );
    const positionById = new Map(
        updates.map((update) => [update.id, update.position])
    );

    return {
        ...board,
        taskPositions: new Map([...board.taskPositions, ...positionById]),
        tasks: board.tasks.map((task) => ({
            ...task,
            status: statusById.get(task.id) ?? task.status,
        })),
    };
}

function moveTaskToColumnInMemory(
    tasks: Task[],
    columns: BoardColumn[],
    activeId: string,
    overId: string
): undefined | { tasks: Task[]; updates: TaskMoveUpdate[] } {
    const activeIndex = tasks.findIndex((task) => task.id === activeId);
    if (activeIndex === -1) return undefined;

    const activeTask = tasks[activeIndex]!;
    const overTask = tasks.find((task) => task.id === overId);
    const overIsColumn = columns.some((column) => column.id === overId);
    if (!overTask && !overIsColumn) return undefined;

    const targetStatus = overTask ? overTask.status : overId;
    if (activeTask.status === targetStatus) return undefined;

    const withoutActive = tasks.filter((task) => task.id !== activeId);
    const updatedTask = { ...activeTask, status: targetStatus };

    let insertIndex: number;
    if (overTask) {
        insertIndex = withoutActive.findIndex((task) => task.id === overId);
        if (insertIndex === -1) insertIndex = withoutActive.length;
    } else {
        let lastIndex = -1;
        for (const [index, task] of withoutActive.entries()) {
            if (task.status === targetStatus) lastIndex = index;
        }
        insertIndex = lastIndex + 1;
    }

    const next = [...withoutActive];
    next.splice(insertIndex, 0, updatedTask);

    const affectedStatuses = new Set<TaskStatus>([
        activeTask.status,
        targetStatus,
    ]);
    const updates: TaskMoveUpdate[] = [];

    for (const status of affectedStatuses) {
        const columnTasks = next.filter((task) => task.status === status);
        for (const [position, task] of columnTasks.entries()) {
            updates.push({
                id: task.id,
                position,
                status,
            });
        }
    }

    return { tasks: next, updates };
}

async function recordTaskActivity(input: {
    changes: TaskActivityChange[];
    projectId: string;
    queryClient: QueryClient;
    taskId: string;
}) {
    if (input.changes.length === 0) return;

    try {
        const { error } = await insertTaskActivityEvent({
            action: "task_updated",
            changes: input.changes,
            projectId: input.projectId,
            taskId: input.taskId,
        });
        if (error) return;
        void input.queryClient.invalidateQueries({
            queryKey: activityKey(input.taskId),
        });
    } catch {
        // Activity is best-effort — never block the primary task write.
    }
}

function releaseTasksChannel(projectId: string) {
    const entry = taskChannels.get(projectId);
    if (!entry) return;

    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;

    taskChannels.delete(projectId);
    void supabase.removeChannel(entry.channel);
}

function reorderTasksInMemory(
    tasks: Task[],
    activeId: string,
    overId: string
): undefined | { tasks: Task[]; updates: TaskMoveUpdate[] } {
    const activeIndex = tasks.findIndex((task) => task.id === activeId);
    const overIndex = tasks.findIndex((task) => task.id === overId);
    if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return undefined;
    }

    const next = [...tasks];
    const [moved] = next.splice(activeIndex, 1);
    if (!moved) return undefined;
    next.splice(overIndex, 0, moved);

    const status = moved.status;
    const columnTasks = next.filter((task) => task.status === status);
    const updates = columnTasks.map((task, position) => ({
        id: task.id,
        position,
        status,
    }));

    return { tasks: next, updates };
}

function resolveBoardName(
    boards: ProjectBoardRecord[] | undefined,
    id: string
) {
    return boards?.find((board) => board.id === id)?.name ?? id;
}

function resolveStatusName(columns: BoardColumn[], status: TaskStatus) {
    return columns.find((column) => column.id === status)?.name ?? status;
}

function subscribeTasksChannel(
    projectId: string,
    onTasksChange: () => void
): () => void {
    const existing = taskChannels.get(projectId);
    if (existing) {
        existing.subscribers += 1;
        return () => releaseTasksChannel(projectId);
    }

    const channel = supabase
        // Unique topic: `supabase.channel(name)` reuses an existing channel, and
        // `.on()` after `subscribe()` throws. Ref-counting + a fresh name avoids both.
        .channel(`tasks:${projectId}:${crypto.randomUUID()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "tasks",
            },
            onTasksChange
        )
        .subscribe();

    taskChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseTasksChannel(projectId);
}
