import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import {
    createBoardColumn,
    createProjectLabel,
    createTaskRecord,
    deleteBoardColumn,
    deleteProjectLabel,
    fetchProjectBoard,
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
import { taskKeys } from "@/features/tasks/model/query-keys";
import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskStatus,
} from "@/features/tasks/model/types";
import { supabase } from "@/shared/api/supabase";

type TaskDetailsUpdate = Partial<Omit<Task, "id" | "status">>;

type TaskMoveUpdate = {
    id: string;
    position: number;
    status: TaskStatus;
};

function getBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
): ProjectBoard | undefined {
    return queryClient.getQueryData<ProjectBoard>(taskKeys.board(projectId));
}

function setBoardSnapshot(
    queryClient: QueryClient,
    projectId: string,
    updater: (current: ProjectBoard) => ProjectBoard,
) {
    queryClient.setQueryData<ProjectBoard>(taskKeys.board(projectId), (current) => {
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

export function useBoard(projectId: string) {
    const queryClient = useQueryClient();

    const boardQuery = useQuery({
        enabled: Boolean(projectId),
        queryFn: () => fetchProjectBoard(projectId),
        queryKey: taskKeys.board(projectId),
    });

    useEffect(() => {
        if (!projectId) return;

        const channel = supabase
            .channel(`board:${projectId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    filter: `project_id=eq.${projectId}`,
                    schema: "public",
                    table: "tasks",
                },
                () => {
                    void queryClient.invalidateQueries({
                        queryKey: taskKeys.board(projectId),
                    });
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    filter: `project_id=eq.${projectId}`,
                    schema: "public",
                    table: "board_columns",
                },
                () => {
                    void queryClient.invalidateQueries({
                        queryKey: taskKeys.board(projectId),
                    });
                },
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    filter: `project_id=eq.${projectId}`,
                    schema: "public",
                    table: "labels",
                },
                () => {
                    void queryClient.invalidateQueries({
                        queryKey: taskKeys.board(projectId),
                    });
                },
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [projectId, queryClient]);

    const addColumnMutation = useMutation({
        mutationFn: (name: string) => createBoardColumn(projectId, name),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const renameColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            name,
        }: {
            columnId: TaskStatus;
            name: string;
        }) => renameBoardColumn(projectId, columnId, name),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const deleteColumnMutation = useMutation({
        mutationFn: ({
            columnId,
            moveTasksTo,
        }: {
            columnId: TaskStatus;
            moveTasksTo?: TaskStatus;
        }) => deleteBoardColumn(projectId, columnId, moveTasksTo),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const reorderColumnsMutation = useMutation({
        mutationFn: (columnIds: TaskStatus[]) =>
            reorderBoardColumns(projectId, columnIds),
        onError: () => {
            toast.error("Failed to reorder columns");
        },
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const moveTaskMutation = useMutation({
        mutationFn: (updates: TaskMoveUpdate[]) =>
            persistTaskMoves(projectId, updates),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
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

            await updateTaskRecord(id, patch);

            if (details.labelIds !== undefined) {
                await replaceTaskLabels(id, details.labelIds ?? []);
            }
        },
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const updateTaskStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
            updateTaskRecord(id, { status }),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
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
                getBoardSnapshot(queryClient, projectId)?.labels ?? [];
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
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const renameLabelMutation = useMutation({
        mutationFn: ({ labelId, name }: { labelId: string; name: string }) =>
            updateProjectLabel(labelId, { name }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
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
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const setLabelCustomColorMutation = useMutation({
        mutationFn: ({ hex, labelId }: { hex: string; labelId: string }) =>
            updateProjectLabel(labelId, { custom_color: hex }),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
        },
    });

    const deleteLabelMutation = useMutation({
        mutationFn: (labelId: string) => deleteProjectLabel(labelId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
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

    const createTaskMutation = useMutation({
        mutationFn: ({
            status,
            title,
        }: {
            status: TaskStatus;
            title: string;
        }) => createTaskRecord(projectId, status, title),
        onSuccess: (task) => {
            setBoardSnapshot(queryClient, projectId, (current) => ({
                ...current,
                taskPositions: new Map([
                    ...current.taskPositions,
                    [task.id, current.taskPositions.get(task.id) ?? 0],
                ]),
                tasks: [...current.tasks, task],
            }));
            void queryClient.invalidateQueries({
                queryKey: taskKeys.board(projectId),
            });
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
        createTask: (status: TaskStatus, title: string) =>
            createTaskMutation.mutateAsync({ status, title }),
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
        error: boardQuery.error,
        isLoading: boardQuery.isLoading,
        labels: board?.labels ?? [],
        moveLabelToProject: async (labelId: string, targetProjectId: string) => {
            const label = board?.labels.find((item) => item.id === labelId);
            if (!label || label.projectId === targetProjectId) return;
            await moveLabelMutation.mutateAsync({ label, targetProjectId });
        },
        moveTaskToColumn: (activeId: string, overId: string) => {
            const snapshot = getBoardSnapshot(queryClient, projectId);
            if (!snapshot) return;

            const result = moveTaskToColumnInMemory(
                snapshot.tasks,
                snapshot.columns,
                activeId,
                overId,
            );
            if (!result) return;

            setBoardSnapshot(queryClient, projectId, (current) => ({
                ...applyTaskUpdates(current, result.updates),
                tasks: result.tasks,
            }));
            moveTaskMutation.mutate(result.updates);
        },
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
            setBoardSnapshot(queryClient, projectId, (snapshot) => ({
                ...snapshot,
                columns: orderColumnsByIds(snapshot.columns, ordered),
            }));
            reorderColumnsMutation.mutate(ordered);
        },
        reorderTaskWithin: (activeId: string, overId: string) => {
            const snapshot = getBoardSnapshot(queryClient, projectId);
            if (!snapshot) return;

            const result = reorderTasksInMemory(
                snapshot.tasks,
                activeId,
                overId,
            );
            if (!result) return;

            setBoardSnapshot(queryClient, projectId, (current) => ({
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
            setBoardSnapshot(queryClient, projectId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, ...details } : task,
                ),
            }));
            updateTaskDetailsMutation.mutate({ details, id });
        },
        updateTaskStatus: (id: string, status: TaskStatus) => {
            setBoardSnapshot(queryClient, projectId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, status } : task,
                ),
            }));
            updateTaskStatusMutation.mutate({ id, status });
        },
    };
}
