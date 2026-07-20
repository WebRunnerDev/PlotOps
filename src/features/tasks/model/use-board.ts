import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
} from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import { toast } from "sonner";

import {
    createBoardColumn,
    createProjectLabel,
    createTaskRecord,
    deleteBoardColumn,
    deleteProjectLabel,
    deleteTaskRecord,
    fetchProjectBoard,
    moveTaskToBoard,
    orderColumnsByIds,
    persistTaskMoves,
    renameBoardColumn,
    reorderBoardColumns,
    replaceTaskLabels,
    type ProjectBoard,
    updateProjectLabel,
    updateTaskRecord,
} from "@/features/tasks/api/tasks-api";
import { LABEL_COLORS } from "@/features/tasks/model/constants";
import { boardKeys, taskKeys } from "@/features/tasks/model/query-keys";
import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskPullRequest,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple `useBoard` mounts share one subscription. */
const boardChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

function subscribeBoardChannel(
    projectId: string,
    onChange: () => void,
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
            onChange,
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "board_columns",
            },
            onChange,
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                filter: `project_id=eq.${projectId}`,
                schema: "public",
                table: "labels",
            },
            onChange,
        )
        .subscribe();

    boardChannels.set(projectId, { channel, subscribers: 1 });
    return () => releaseBoardChannel(projectId);
}

function releaseBoardChannel(projectId: string) {
    const entry = boardChannels.get(projectId);
    if (!entry) return;

    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;

    boardChannels.delete(projectId);
    void supabase.removeChannel(entry.channel);
}

type TaskDetailsUpdate = Partial<
    Omit<Task, "branchName" | "id" | "pr" | "status">
> & {
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

function boardQueryKey(projectId: string, boardId: string) {
    return taskKeys.board(projectId, boardId);
}

function invalidateProjectBoards(queryClient: QueryClient, projectId: string) {
    void queryClient.invalidateQueries({
        queryKey: [...taskKeys.all, "board", projectId],
    });
}

function getBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
    boardId: string,
): ProjectBoard | undefined {
    return queryClient.getQueryData<ProjectBoard>(boardQueryKey(projectId, boardId));
}

function setBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
    boardId: string,
    updater: (current: ProjectBoard) => ProjectBoard,
) {
    queryClient.setQueryData<ProjectBoard>(boardQueryKey(projectId, boardId), (current) => {
        if (!current) return current;
        return updater(current);
    });
}

function applyTaskUpdates(
    board: ProjectBoard,
    updates: TaskMoveUpdate[],
): ProjectBoard {
    const statusById = new Map(updates.map((update) => [update.id, update.status]));
    const positionById = new Map(
        updates.map((update) => [update.id, update.position]),
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

function reorderTasksInMemory(
    tasks: Task[],
    activeId: string,
    overId: string,
): { tasks: Task[]; updates: TaskMoveUpdate[] } | undefined {
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

function moveTaskToColumnInMemory(
    tasks: Task[],
    columns: BoardColumn[],
    activeId: string,
    overId: string,
): { tasks: Task[]; updates: TaskMoveUpdate[] } | undefined {
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

export function useBoard(projectId: string, boardId: string) {
    const queryClient = useQueryClient();

    const boardQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => fetchProjectBoard(projectId, boardId),
        queryKey: boardQueryKey(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId) return;

        return subscribeBoardChannel(projectId, () => {
            invalidateProjectBoards(queryClient, projectId);
        });
    }, [projectId, queryClient]);

    const addColumnMutation = useMutation({
        mutationFn: (name: string) => createBoardColumn(projectId, boardId, name),
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
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
            invalidateProjectBoards(queryClient, projectId);
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
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: (columnIds: TaskStatus[]) =>
            reorderBoardColumns(boardId, columnIds),
        onError: () => {
            toast.error("Failed to reorder columns");
        },
        onSettled: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const moveTaskMutation = useMutation({
        mutationFn: (updates: TaskMoveUpdate[]) =>
            persistTaskMoves(boardId, updates),
        onSettled: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const updateTaskDetailsMutation = useMutation({
        mutationFn: async ({
            id,
            details,
        }: {
            id: string;
            details: TaskDetailsUpdate;
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

            await updateTaskRecord(id, patch);

            if (details.labelIds !== undefined) {
                await replaceTaskLabels(id, details.labelIds ?? []);
            }
        },
        onSettled: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const updateTaskStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
            updateTaskRecord(id, { status }),
        onSettled: () => {
            invalidateProjectBoards(queryClient, projectId);
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
            return createProjectLabel(
                projectId,
                name,
                nextColor,
                customColor,
            );
        },
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const renameLabelMutation = useMutation({
        mutationFn: ({ labelId, name }: { labelId: string; name: string }) =>
            updateProjectLabel(labelId, { name }),
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
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
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const setLabelCustomColorMutation = useMutation({
        mutationFn: ({ hex, labelId }: { hex: string; labelId: string }) =>
            updateProjectLabel(labelId, { custom_color: hex }),
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const deleteLabelMutation = useMutation({
        mutationFn: (labelId: string) => deleteProjectLabel(labelId),
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
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
                label.customColor,
            ),
        onSuccess: () => {
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
                label.customColor,
            );
            await deleteProjectLabel(label.id);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
    });

    const moveTaskToBoardMutation = useMutation({
        mutationFn: ({
            targetBoardId,
            targetStatus,
            taskId,
        }: {
            targetBoardId: string;
            targetStatus: TaskStatus;
            taskId: string;
        }) => moveTaskToBoard(taskId, targetBoardId, targetStatus),
        onSuccess: () => {
            invalidateProjectBoards(queryClient, projectId);
            void queryClient.invalidateQueries({ queryKey: boardKeys.list(projectId) });
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
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (taskId: string) => deleteTaskRecord(taskId),
        onError: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
        onSettled: () => {
            invalidateProjectBoards(queryClient, projectId);
        },
    });

    const board = boardQuery.data;

    return {
        addColumn: (name: string) => addColumnMutation.mutateAsync(name),
        addLabel: async (
            name: string,
            color?: LabelColor,
            customColor?: string,
        ) => {
            const label = await addLabelMutation.mutateAsync({
                color,
                customColor,
                name,
            });
            return label.id;
        },
        columns: board?.columns ?? [],
        createTask: (status: TaskStatus, title: string, taskType?: TaskType) =>
            createTaskMutation.mutateAsync({ status, taskType, title }),
        copyLabelToProject: async (labelId: string, targetProjectId: string) => {
            const label = board?.labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            const created = await copyLabelMutation.mutateAsync({
                label,
                targetProjectId,
            });
            return created.id;
        },
        deleteColumn: async (
            columnId: TaskStatus,
            moveTasksTo?: TaskStatus,
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
            await deleteTaskMutation.mutateAsync(taskId);
        },
        error: boardQuery.error,
        isLoading: boardQuery.isLoading,
        labels: board?.labels ?? [],
        moveLabelToProject: async (labelId: string, targetProjectId: string) => {
            const label = board?.labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            await moveLabelMutation.mutateAsync({ label, targetProjectId });
        },
        moveTaskToOtherBoard: async (
            taskId: string,
            targetBoardId: string,
            targetStatus: TaskStatus,
        ) => {
            const task = board?.tasks.find((item) => item.id === taskId);
            if (!task || targetBoardId === boardId) return;
            await moveTaskToBoardMutation.mutateAsync({
                targetBoardId,
                targetStatus,
                taskId,
            });
        },
        boardId,
        moveTaskToColumn: (activeId: string, overId: string) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            if (!snapshot) return;

            const result = moveTaskToColumnInMemory(
                snapshot.tasks,
                snapshot.columns,
                activeId,
                overId,
            );
            if (!result) return;

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...applyTaskUpdates(current, result.updates),
                tasks: result.tasks,
            }));
            moveTaskMutation.mutate(result.updates);
        },
        projectId,
        renameColumn: async (columnId: TaskStatus, name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return false;
            const duplicate = (board?.columns ?? []).some(
                (column) =>
                    column.id !== columnId &&
                    column.name.trim().toLowerCase() === trimmed.toLowerCase(),
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
                    label.name.toLowerCase() === trimmed.toLowerCase(),
            );
            if (duplicate) return false;
            await renameLabelMutation.mutateAsync({ labelId, name: trimmed });
            return true;
        },
        reorderColumns: (activeId: TaskStatus, overId: TaskStatus) => {
            const current = board?.columns ?? [];
            const oldIndex = current.findIndex((column) => column.id === activeId);
            const newIndex = current.findIndex((column) => column.id === overId);
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

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
                overId,
            );
            if (!result) return;

            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...applyTaskUpdates(current, result.updates),
                tasks: result.tasks,
            }));
            moveTaskMutation.mutate(result.updates);
        },
        setLabelCustomColor: (labelId: string, hex: string) =>
            setLabelCustomColorMutation.mutateAsync({ hex, labelId }),
        tasks: board?.tasks ?? [],
        updateLabelColor: (labelId: string, color: LabelColor) =>
            updateLabelColorMutation.mutateAsync({ color, labelId }),
        updateTaskDetails: (id: string, details: TaskDetailsUpdate) => {
            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) => {
                    if (task.id !== id) return task;
                    const {
                        branchName: nextBranch,
                        pr: nextPr,
                        ...rest
                    } = details;
                    return {
                        ...task,
                        ...rest,
                        ...(nextBranch !== undefined
                            ? { branchName: nextBranch ?? undefined }
                            : {}),
                        ...(nextPr !== undefined
                            ? { pr: nextPr ?? undefined }
                            : {}),
                    };
                }),
            }));
            updateTaskDetailsMutation.mutate({ details, id });
        },
        updateTaskStatus: (id: string, status: TaskStatus) => {
            setBoardSnapshot(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, status } : task,
                ),
            }));
            updateTaskStatusMutation.mutate({ id, status });
        },
    };
}
