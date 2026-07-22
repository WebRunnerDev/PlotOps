import type { RealtimeChannel } from "@supabase/supabase-js";

import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import type { ProjectBoardRecord } from "@/features/tasks/api/boards-api";
import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskActivityChange,
    TaskPullRequest,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { insertTaskActivityEvent } from "@/features/tasks/api/task-activity-api";
import {
    archiveTaskRecord,
    createBoardColumn,
    createProjectLabel,
    createTaskRecord,
    deleteBoardColumn,
    deleteProjectLabel,
    deleteTaskRecord,
    fetchBoardColumns,
    fetchBoardTasks,
    fetchProjectLabels,
    moveTaskToBoard,
    orderColumnsByIds,
    persistTaskMoves,
    type ProjectBoard,
    renameBoardColumn,
    reorderBoardColumns,
    replaceTaskLabels,
    restoreTaskRecord,
    updateProjectLabel,
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
import { LABEL_COLORS } from "@/features/tasks/model/constants";
import {
    boardKeys,
    labelKeys,
    taskKeys,
} from "@/features/tasks/model/query-keys";
import { activityKey } from "@/features/tasks/model/use-task-activity";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple `useBoard` mounts share one subscription. */
const boardChannels = new Map<
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

    const columnsQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => fetchBoardColumns(projectId, boardId),
        queryKey: boardKeys.columns(projectId, boardId),
    });

    const labelsQuery = useQuery({
        enabled: Boolean(projectId),
        queryFn: () => fetchProjectLabels(projectId),
        queryKey: labelKeys.project(projectId),
    });

    const tasksQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => fetchBoardTasks(boardId),
        queryKey: taskKeys.board(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId) return;

        return subscribeBoardChannel(projectId, {
            onColumnsChange: () => {
                invalidateBoardWorkspaceSlice(
                    queryClient,
                    projectId,
                    "columns"
                );
            },
            onLabelsChange: () => {
                invalidateBoardWorkspaceSlice(queryClient, projectId, "labels");
            },
            onTasksChange: () => {
                invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            },
        });
    }, [projectId, queryClient]);

    const addColumnMutation = useMutation({
        mutationFn: (name: string) =>
            createBoardColumn(projectId, boardId, name),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const renameColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            name,
        }: {
            columnId: TaskStatus;
            name: string;
        }) => renameBoardColumn(boardId, columnId, name),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const deleteColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            moveTasksTo,
        }: {
            columnId: TaskStatus;
            moveTasksTo?: TaskStatus;
        }) => deleteBoardColumn(boardId, columnId, moveTasksTo),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: (columnIds: TaskStatus[]) =>
            reorderBoardColumns(boardId, columnIds),
        onError: () => {
            toast.error("Failed to reorder columns");
        },
        onSettled: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

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
            invalidateBoardWorkspace(queryClient, projectId);
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
            invalidateBoardWorkspace(queryClient, projectId);
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
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const addLabelMutation = useMutation({
        mutationFn: ({
            color,
            customColor,
            name,
        }: {
            color?: LabelColor;
            customColor?: string;
            name: string;
        }) => {
            const projectLabels =
                getBoardSnapshot(queryClient, projectId, boardId)?.labels ?? [];
            const nextColor =
                color ??
                LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]!;
            return createProjectLabel(projectId, name, nextColor, customColor);
        },
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const renameLabelMutation = useMutation({
        mutationFn: ({ labelId, name }: { labelId: string; name: string }) =>
            updateProjectLabel(labelId, { name }),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const updateLabelColorMutation = useMutation({
        mutationFn: ({
            color,
            labelId,
        }: {
            color: LabelColor;
            labelId: string;
        }) => updateProjectLabel(labelId, { color, custom_color: null }),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const setLabelCustomColorMutation = useMutation({
        mutationFn: ({ hex, labelId }: { hex: string; labelId: string }) =>
            updateProjectLabel(labelId, { custom_color: hex }),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const deleteLabelMutation = useMutation({
        mutationFn: (labelId: string) => deleteProjectLabel(labelId),
        onSuccess: () => {
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const copyLabelMutation = useMutation({
        mutationFn: ({
            label,
            targetProjectId,
        }: {
            label: ProjectLabel;
            targetProjectId: string;
        }) =>
            createProjectLabel(
                targetProjectId,
                label.name,
                label.color,
                label.customColor
            ),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: labelKeys.project(projectId),
            });
            void queryClient.invalidateQueries({
                queryKey: labelKeys.project(variables.targetProjectId),
            });
            void queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });

    const moveLabelMutation = useMutation({
        mutationFn: async ({
            label,
            targetProjectId,
        }: {
            label: ProjectLabel;
            targetProjectId: string;
        }) => {
            await createProjectLabel(
                targetProjectId,
                label.name,
                label.color,
                label.customColor
            );
            await deleteProjectLabel(label.id);
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: labelKeys.project(projectId),
            });
            void queryClient.invalidateQueries({
                queryKey: labelKeys.project(variables.targetProjectId),
            });
            void queryClient.invalidateQueries({ queryKey: taskKeys.all });
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
            invalidateBoardWorkspace(queryClient, projectId);
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (taskId: string) => deleteTaskRecord(taskId),
        onError: () => {
            invalidateBoardWorkspace(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: () => {
            invalidateBoardWorkspace(queryClient, projectId);
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
            invalidateBoardWorkspace(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: (_data, _error, taskId) => {
            invalidateBoardWorkspace(queryClient, projectId);
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
            invalidateBoardWorkspace(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: (_data, _error, taskId) => {
            invalidateBoardWorkspace(queryClient, projectId);
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
            void queryClient.invalidateQueries({
                queryKey: activityKey(taskId),
            });
        },
    });

    const board =
        columnsQuery.data && labelsQuery.data && tasksQuery.data
            ? composeProjectBoard(
                  columnsQuery.data,
                  labelsQuery.data,
                  tasksQuery.data
              )
            : undefined;

    return {
        addColumn: (name: string) => addColumnMutation.mutateAsync(name),
        addLabel: async (
            name: string,
            color?: LabelColor,
            customColor?: string
        ) => {
            const label = await addLabelMutation.mutateAsync({
                color,
                customColor,
                name,
            });
            return label.id;
        },
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
        columns: board?.columns ?? [],
        copyLabelToProject: async (
            labelId: string,
            targetProjectId: string
        ) => {
            const label = board?.labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            const created = await copyLabelMutation.mutateAsync({
                label,
                targetProjectId,
            });
            return created.id;
        },
        createTask: (status: TaskStatus, title: string, taskType?: TaskType) =>
            createTaskMutation.mutateAsync({ status, taskType, title }),
        deleteColumn: async (
            columnId: TaskStatus,
            moveTasksTo?: TaskStatus
        ) => {
            if ((board?.columns.length ?? 0) <= 1) return false;
            await deleteColumnMutation.mutateAsync({ columnId, moveTasksTo });
            return true;
        },
        deleteLabel: (labelId: string) =>
            deleteLabelMutation.mutateAsync(labelId),
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
        error:
            columnsQuery.error ?? labelsQuery.error ?? tasksQuery.error ?? null,
        isLoading:
            columnsQuery.isLoading ||
            labelsQuery.isLoading ||
            tasksQuery.isLoading,
        labels: board?.labels ?? [],
        moveLabelToProject: async (
            labelId: string,
            targetProjectId: string
        ) => {
            const label = board?.labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            await moveLabelMutation.mutateAsync({ label, targetProjectId });
        },
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
        renameColumn: async (columnId: TaskStatus, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = (board?.columns ?? []).some(
                (column) =>
                    column.id !== columnId &&
                    column.name.trim().toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return false;
            await renameColumnMutation.mutateAsync({ columnId, name: trimmed });
            return true;
        },
        renameLabel: async (labelId: string, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = (board?.labels ?? []).some(
                (label) =>
                    label.id !== labelId &&
                    label.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return false;
            await renameLabelMutation.mutateAsync({ labelId, name: trimmed });
            return true;
        },
        reorderColumns: (activeId: TaskStatus, overId: TaskStatus) => {
            const current = board?.columns ?? [];
            const oldIndex = current.findIndex(
                (column) => column.id === activeId
            );
            const newIndex = current.findIndex(
                (column) => column.id === overId
            );
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
                return;

            const next = [...current];
            const [moved] = next.splice(oldIndex, 1);
            if (!moved) return;
            next.splice(newIndex, 0, moved);

            const ordered = next.map((column) => column.id);
            setBoardSnapshot(queryClient, projectId, boardId, (snapshot) => ({
                ...snapshot,
                columns: orderColumnsByIds(snapshot.columns, ordered),
            }));
            reorderColumnsMutation.mutate(ordered);
        },
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
        setLabelCustomColor: (labelId: string, hex: string) =>
            setLabelCustomColorMutation.mutateAsync({ hex, labelId }),
        tasks: board?.tasks ?? [],
        updateLabelColor: (labelId: string, color: LabelColor) =>
            updateLabelColorMutation.mutateAsync({ color, labelId }),
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

function releaseBoardChannel(projectId: string) {
    const entry = boardChannels.get(projectId);
    if (!entry) return;

    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;

    boardChannels.delete(projectId);
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

function resolveLabelNames(labels: ProjectLabel[], labelIds: string[] = []) {
    const byId = new Map(labels.map((label) => [label.id, label.name]));
    return labelIds.map((id) => byId.get(id)).filter(Boolean);
}

function resolveStatusName(columns: BoardColumn[], status: TaskStatus) {
    return columns.find((column) => column.id === status)?.name ?? status;
}

function subscribeBoardChannel(
    projectId: string,
    handlers: {
        onColumnsChange: () => void;
        onLabelsChange: () => void;
        onTasksChange: () => void;
    }
): () => void {
    const existing = boardChannels.get(projectId);
    if (existing) {
        existing.subscribers += 1;
        return () => releaseBoardChannel(projectId);
    }

    const channel = supabase
        // Unique topic: `supabase.channel(name)` reuses an existing channel, and
        // `.on()` after `subscribe()` throws. Ref-counting + a fresh name avoids both.
        .channel(`board:${projectId}:${crypto.randomUUID()}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "tasks",
            },
            handlers.onTasksChange
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "board_columns",
            },
            handlers.onColumnsChange
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "labels",
            },
            handlers.onLabelsChange
        )
        .subscribe();

    boardChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseBoardChannel(projectId);
}
