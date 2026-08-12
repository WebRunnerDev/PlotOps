import type { RealtimeChannel } from "@supabase/supabase-js";

import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { BoardColumn, ProjectBoardRecord } from "@/features/boards";
import type { TaskEstimate } from "@/features/tasks/lib/task-estimate";
import type {
    Task,
    TaskActivityChange,
    TaskPriority,
    TaskPullRequest,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { boardKeys } from "@/features/boards";
import { isGuest } from "@/features/guest-mode";
import { resolveLabelNames } from "@/features/labels";
import {
    createNotificationsForStatusChange,
    createNotificationsForWatchers,
    createTaskNotifications,
} from "@/features/notifications/api/notifications-api";
import { notifyNewMentionsBestEffort } from "@/features/notifications/lib/notify-new-mentions";
import { planAssigneeChangeNotifications } from "@/features/notifications/lib/plan-assignee-change-notifications";
import { planAuthorChangeNotifications } from "@/features/notifications/lib/plan-author-change-notifications";
import { planBoardMoveWatcherNotification } from "@/features/notifications/lib/plan-board-move-watcher-notification";
import { planDeadlineWatcherNotification } from "@/features/notifications/lib/plan-deadline-watcher-notification";
import { planPriorityWatcherNotification } from "@/features/notifications/lib/plan-priority-watcher-notification";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import { insertTaskActivityEvent } from "@/features/tasks/api/task-activity-api";
import {
    type BoardTasksCache,
    type TaskRecordPatch,
} from "@/features/tasks/api/tasks-api";
import {
    applyDetailsToSnapshot,
    buildTaskActivityChanges,
    toTaskActivitySnapshot,
} from "@/features/tasks/lib/build-task-activity-changes";
import { moveTasksToColumnInMemory } from "@/features/tasks/lib/move-task-to-column-in-memory";
import {
    reorderTasksInMemory,
    type TaskMoveUpdate,
} from "@/features/tasks/lib/reorder-tasks-in-memory";
import {
    getBoardSnapshot,
    invalidateBoardWorkspace,
    invalidateBoardWorkspaceSlice,
    setTasksCache,
} from "@/features/tasks/model/board-query-cache";
import { taskKeys } from "@/features/tasks/model/query-keys";
import { activityKey } from "@/features/tasks/model/use-task-activity";
import { supabase } from "@/shared/api/supabase";

/** Ref-count Realtime channels so multiple mounts share one `tasks` subscription. */
const taskChannels = new Map<
    string,
    { channel: RealtimeChannel; subscribers: number }
>();

/** Author transfer for Notification fan-out — not an Activity feed field. */
type AuthorNotificationChange = {
    field: "author";
    from: IdNameSnapshot | null;
    to: IdNameSnapshot | null;
};

type IdNameSnapshot = { id: string; name: string };

type TaskDetailsUpdate = {
    /** Pass `null` to clear assignee or author. */
    assignee?: null | Task["assignee"];
    author?: null | Task["author"];
    /** Pass `null` to clear a linked branch. */
    branchName?: null | string;
    /** Pass `null` to clear the deadline. */
    deadline?: null | string;
    /** Pass `null` to clear the description. */
    description?: null | string;
    /** Pass `null` to clear estimate (unestimated). Manager+ only. */
    estimate?: null | TaskEstimate;
    /** Pass `null` (or `[]`) to clear all labels. */
    labelIds?: null | string[];
    /** Pass `null` to clear a linked pull request. */
    pr?: null | TaskPullRequest;
    /** Pass `null` to clear priority (“None”). */
    priority?: null | TaskPriority;
} & Partial<
    Omit<
        Task,
        | "assignee"
        | "author"
        | "branchName"
        | "deadline"
        | "description"
        | "estimate"
        | "id"
        | "labelIds"
        | "pr"
        | "priority"
        | "status"
    >
>;

/**
 * Board Tasks only — columns and Labels come from `@/features/boards` /
 * `@/features/labels`. Composition lives in the board page / kanban widget.
 */
export function useBoardTasks(projectId: string, boardId: string) {
    const queryClient = useQueryClient();
    const dragGestureCacheReference = useRef<BoardTasksCache | null>(null);
    const guest = isGuest();
    const tasksProvider = resolveTasksProvider(guest);

    const tasksQuery = useQuery({
        enabled: Boolean(projectId && boardId),
        queryFn: () => tasksProvider.fetchBoardTasks(boardId),
        queryKey: taskKeys.board(projectId, boardId),
    });

    useEffect(() => {
        if (!projectId || guest) return;

        return subscribeTasksChannel(projectId, () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        });
    }, [guest, projectId, queryClient]);

    const moveTaskMutation = useMutation({
        mutationFn: async ({
            activities,
            activity,
            updates,
        }: {
            activities?: {
                changes: TaskActivityChange[];
                taskId: string;
            }[];
            activity?: {
                changes: TaskActivityChange[];
                taskId: string;
            };
            previousCache?: BoardTasksCache;
            updates: TaskMoveUpdate[];
        }) => {
            await tasksProvider.persistTaskMoves(boardId, updates);
            if (guest) return;
            const activityEntries = activities ?? (activity ? [activity] : []);
            for (const entry of activityEntries) {
                await notifyStatusChangeBestEffort({
                    activityChanges: entry.changes,
                    projectId,
                    taskId: entry.taskId,
                });
                await recordTaskActivity({
                    changes: entry.changes,
                    projectId,
                    queryClient,
                    taskId: entry.taskId,
                });
            }
        },
        onError: (_error, variables) => {
            if (variables.previousCache) {
                queryClient.setQueryData(
                    taskKeys.board(projectId, boardId),
                    variables.previousCache
                );
            }
            toast.error("Failed to move task");
        },
        onSettled: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
        },
    });

    const updateTaskDetailsMutation = useMutation({
        mutationFn: async ({
            activityChanges,
            authorChange,
            details,
            id,
            previousDescription,
        }: {
            activityChanges: TaskActivityChange[];
            /** Author is not an Activity field (SPEC); still drives fan-out. */
            authorChange?: AuthorNotificationChange | null;
            details: TaskDetailsUpdate;
            id: string;
            previousCache?: BoardTasksCache;
            previousDescription?: string;
        }) => {
            const patch: TaskRecordPatch = {};
            if (details.title !== undefined) patch.title = details.title;
            if (details.description !== undefined) {
                patch.description = details.description ?? null;
            }
            if (details.priority !== undefined) {
                patch.priority = details.priority ?? null;
            }
            if (details.estimate !== undefined) {
                patch.estimate = details.estimate ?? null;
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

            await tasksProvider.updateTaskDetails(
                id,
                patch,
                details.labelIds === undefined
                    ? undefined
                    : (details.labelIds ?? [])
            );

            if (guest) {
                return;
            }

            if (details.description !== undefined) {
                await notifyNewMentionsBestEffort({
                    nextBody: details.description ?? "",
                    previousBody: previousDescription ?? "",
                    source: "description",
                    taskId: id,
                });
            }

            await notifyPriorityChangeBestEffort({
                activityChanges,
                projectId,
                taskId: id,
            });

            await notifyDeadlineChangeBestEffort({
                activityChanges,
                projectId,
                taskId: id,
            });

            await notifyPersonFieldChangesBestEffort({
                activityChanges,
                authorChange,
                projectId,
                taskId: id,
            });

            await recordTaskActivity({
                changes: activityChanges,
                projectId,
                queryClient,
                taskId: id,
            });
        },
        onError: (_error, variables) => {
            if (variables.previousCache) {
                queryClient.setQueryData(
                    taskKeys.board(projectId, boardId),
                    variables.previousCache
                );
            }
            toast.error("Failed to update task");
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
            previousCache?: BoardTasksCache;
            status: TaskStatus;
        }) => {
            await tasksProvider.updateTaskRecord(id, { status });

            if (guest) {
                return;
            }

            await notifyStatusChangeBestEffort({
                activityChanges,
                projectId,
                taskId: id,
            });

            await recordTaskActivity({
                changes: activityChanges,
                projectId,
                queryClient,
                taskId: id,
            });
        },
        onError: (_error, variables) => {
            if (variables.previousCache) {
                queryClient.setQueryData(
                    taskKeys.board(projectId, boardId),
                    variables.previousCache
                );
            }
            toast.error("Failed to update task status");
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
            await tasksProvider.moveTaskToBoard(
                taskId,
                targetBoardId,
                targetStatus
            );

            if (guest) {
                return;
            }

            await notifyBoardMoveBestEffort({
                activityChanges,
                projectId,
                taskId,
            });

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
            sprintId,
            status,
            taskType,
            title,
        }: {
            sprintId?: string;
            status: TaskStatus;
            taskType?: TaskType;
            title: string;
        }) =>
            tasksProvider.createTaskRecord(
                projectId,
                boardId,
                status,
                title,
                taskType,
                sprintId
            ),
        onSuccess: (task) => {
            setTasksCache(queryClient, projectId, boardId, (current) => ({
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
        mutationFn: (taskId: string) => tasksProvider.deleteTaskRecord(taskId),
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
        mutationFn: async (taskIds: string[]) => {
            const uniqueIds = [...new Set(taskIds.filter(Boolean))];
            const { archivedCount } =
                await tasksProvider.archiveTaskRecords(uniqueIds);
            return { archivedCount, taskIds: uniqueIds };
        },
        onError: () => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        },
        onSettled: (_data, _error, taskIds) => {
            invalidateBoardWorkspaceSlice(queryClient, projectId, "tasks");
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
            for (const taskId of taskIds) {
                void queryClient.invalidateQueries({
                    queryKey: activityKey(taskId),
                });
            }
        },
    });

    const restoreTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            await tasksProvider.restoreTaskRecord(taskId, boardId);
            if (guest) {
                return;
            }
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

    const tasks = tasksQuery.data?.tasks ?? [];

    const archiveTasks = async (taskIds: string[]) => {
        const uniqueIds = [...new Set(taskIds.filter(Boolean))];
        if (uniqueIds.length === 0) return { archivedCount: 0 };

        setTasksCache(queryClient, projectId, boardId, (current) => {
            const idSet = new Set(uniqueIds);
            const nextPositions = new Map(current.taskPositions);
            for (const taskId of uniqueIds) {
                nextPositions.delete(taskId);
            }
            return {
                taskPositions: nextPositions,
                tasks: current.tasks.filter((task) => !idSet.has(task.id)),
            };
        });
        return archiveTaskMutation.mutateAsync(uniqueIds);
    };

    const moveTasksToColumn = (
        activeIds: readonly string[],
        overId: string,
        options?: { displayedTaskIds?: ReadonlySet<string>; persist?: boolean }
    ) => {
        const persist = options?.persist ?? true;
        const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
        if (!snapshot) return;

        const previousCache =
            dragGestureCacheReference.current ??
            queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );

        const result = moveTasksToColumnInMemory(
            snapshot.tasks,
            snapshot.columns,
            activeIds,
            overId,
            options?.displayedTaskIds
        );
        if (!result) return;

        if (!persist && !dragGestureCacheReference.current && previousCache) {
            dragGestureCacheReference.current = previousCache;
        }

        const activities: {
            changes: TaskActivityChange[];
            taskId: string;
        }[] = [];
        for (const activeId of activeIds) {
            const previous = snapshot.tasks.find(
                (task) => task.id === activeId
            );
            const next = result.tasks.find((task) => task.id === activeId);
            if (!previous || !next || previous.status === next.status) {
                continue;
            }
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
            activities.push({
                changes: buildTaskActivityChanges(before, after),
                taskId: activeId,
            });
        }

        setTasksCache(queryClient, projectId, boardId, (current) =>
            applyTaskUpdates(current, result.updates, result.tasks)
        );

        if (!persist) return;

        moveTaskMutation.mutate({
            activities,
            previousCache,
            updates: result.updates,
        });
        dragGestureCacheReference.current = null;
    };

    return {
        archiveTask: async (taskId: string) => {
            await archiveTasks([taskId]);
        },
        archiveTasks,
        boardId,
        /**
         * Persist the board task cache vs the in-progress drag gesture snapshot.
         * No-op when no live preview ran (same-column-only drags).
         * Records status activity for every task that changed column.
         */
        commitTaskDragGesture: () => {
            const previousCache = dragGestureCacheReference.current;
            if (!previousCache) return;

            const current = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
            dragGestureCacheReference.current = null;
            if (!current) return;

            const updates = diffTaskMoveUpdates(previousCache, current);
            if (updates.length === 0) return;

            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            const activities: {
                changes: TaskActivityChange[];
                taskId: string;
            }[] = [];
            if (snapshot) {
                for (const next of current.tasks) {
                    const previous = previousCache.tasks.find(
                        (task) => task.id === next.id
                    );
                    if (!previous || previous.status === next.status) continue;
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
                            name: resolveStatusName(
                                snapshot.columns,
                                next.status
                            ),
                        },
                    };
                    activities.push({
                        changes: buildTaskActivityChanges(before, after),
                        taskId: next.id,
                    });
                }
            }

            moveTaskMutation.mutate({
                activities,
                previousCache,
                updates,
            });
        },
        createTask: (
            status: TaskStatus,
            title: string,
            options?: { sprintId?: string; taskType?: TaskType }
        ) =>
            createTaskMutation.mutateAsync({
                sprintId: options?.sprintId,
                status,
                taskType: options?.taskType,
                title,
            }),
        deleteTask: async (taskId: string) => {
            setTasksCache(queryClient, projectId, boardId, (current) => {
                const nextPositions = new Map(current.taskPositions);
                nextPositions.delete(taskId);
                return {
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
        error: tasksQuery.error ?? null,
        isLoading: tasksQuery.isLoading,
        moveTasksToColumn,
        moveTaskToColumn: (
            activeId: string,
            overId: string,
            options?: { persist?: boolean }
        ) => {
            moveTasksToColumn([activeId], overId, options);
        },
        moveTaskToOtherBoard: async (
            taskId: string,
            targetBoardId: string,
            targetStatus: TaskStatus,
            targetStatusName?: string
        ) => {
            const task = tasks.find((item) => item.id === taskId);
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
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
                    snapshot?.labels ?? [],
                    task.labelIds
                ),
                statusName: resolveStatusName(
                    snapshot?.columns ?? [],
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
                    name: targetStatusName ?? targetStatus,
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
        reorderTaskWithin: (
            activeId: string,
            overId: string,
            options?: {
                persist?: boolean;
                visibleColumnTaskIds?: readonly string[];
            }
        ) => {
            const persist = options?.persist ?? true;
            const cache = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
            if (!cache) return;

            const result = reorderTasksInMemory(
                cache.tasks,
                activeId,
                overId,
                options?.visibleColumnTaskIds
            );
            if (!result) return;

            if (!persist && !dragGestureCacheReference.current) {
                dragGestureCacheReference.current = cache;
            }

            setTasksCache(queryClient, projectId, boardId, (current) =>
                applyTaskUpdates(current, result.updates, result.tasks)
            );

            if (!persist) return;

            // Position-only reorders are intentionally not logged (SPEC).
            moveTaskMutation.mutate({
                previousCache: dragGestureCacheReference.current ?? cache,
                updates: result.updates,
            });
            dragGestureCacheReference.current = null;
        },
        restoreTask: async (taskId: string) => {
            await restoreTaskMutation.mutateAsync(taskId);
        },
        rollbackTaskDragGesture: () => {
            const previousCache = dragGestureCacheReference.current;
            dragGestureCacheReference.current = null;
            if (!previousCache) return;
            queryClient.setQueryData(
                taskKeys.board(projectId, boardId),
                previousCache
            );
        },
        tasks,
        /** True once board tasks have been fetched (including an empty list). */
        tasksReady: tasksQuery.data !== undefined,
        updateTaskDetails: (id: string, details: TaskDetailsUpdate) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            const previousCache = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
            const previous = snapshot?.tasks.find((task) => task.id === id);
            let activityChanges: TaskActivityChange[] = [];
            let authorChange: AuthorNotificationChange | null = null;

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
                    estimate: details.estimate,
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
                authorChange = buildAuthorNotificationChange(
                    previous.author,
                    details.author
                );
            }

            setTasksCache(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) => {
                    if (task.id !== id) return task;
                    const {
                        assignee: nextAssignee,
                        author: nextAuthor,
                        branchName: nextBranch,
                        deadline: nextDeadline,
                        description: nextDescription,
                        estimate: nextEstimate,
                        labelIds: nextLabelIds,
                        pr: nextPr,
                        priority: nextPriority,
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
                        ...(nextDeadline === undefined
                            ? {}
                            : { deadline: nextDeadline ?? undefined }),
                        ...(nextDescription === undefined
                            ? {}
                            : {
                                  description: nextDescription ?? undefined,
                              }),
                        ...(nextEstimate === undefined
                            ? {}
                            : { estimate: nextEstimate ?? undefined }),
                        ...(nextLabelIds === undefined
                            ? {}
                            : {
                                  labelIds:
                                      nextLabelIds && nextLabelIds.length > 0
                                          ? nextLabelIds
                                          : undefined,
                              }),
                        ...(nextPr === undefined
                            ? {}
                            : { pr: nextPr ?? undefined }),
                        ...(nextPriority === undefined
                            ? {}
                            : { priority: nextPriority ?? undefined }),
                    };
                }),
            }));
            updateTaskDetailsMutation.mutate({
                activityChanges,
                authorChange,
                details,
                id,
                previousCache,
                previousDescription:
                    details.description === undefined
                        ? undefined
                        : (previous?.description ?? ""),
            });
        },
        updateTaskStatus: (id: string, status: TaskStatus) => {
            const snapshot = getBoardSnapshot(queryClient, projectId, boardId);
            const previousCache = queryClient.getQueryData<BoardTasksCache>(
                taskKeys.board(projectId, boardId)
            );
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

            setTasksCache(queryClient, projectId, boardId, (current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                    task.id === id ? { ...task, status } : task
                ),
            }));
            updateTaskStatusMutation.mutate({
                activityChanges,
                id,
                previousCache,
                status,
            });
        },
    };
}

function applyTaskUpdates(
    cache: BoardTasksCache,
    updates: TaskMoveUpdate[],
    tasks: Task[]
): BoardTasksCache {
    const positionById = new Map(
        updates.map((update) => [update.id, update.position])
    );

    return {
        taskPositions: new Map([...cache.taskPositions, ...positionById]),
        tasks,
    };
}

function buildAuthorNotificationChange(
    previousAuthor: Task["author"] | undefined,
    nextAuthor: TaskDetailsUpdate["author"]
): AuthorNotificationChange | null {
    if (nextAuthor === undefined) return null;

    const from = previousAuthor
        ? { id: previousAuthor.id, name: previousAuthor.name }
        : null;
    const to = nextAuthor ? { id: nextAuthor.id, name: nextAuthor.name } : null;

    if ((from?.id ?? null) === (to?.id ?? null)) return null;

    return { field: "author", from, to };
}

function diffTaskMoveUpdates(
    previous: BoardTasksCache,
    current: BoardTasksCache
): TaskMoveUpdate[] {
    const previousById = new Map(
        previous.tasks.map((task) => [task.id, task] as const)
    );
    const updates: TaskMoveUpdate[] = [];

    for (const task of current.tasks) {
        const before = previousById.get(task.id);
        const previousPosition = previous.taskPositions.get(task.id);
        const nextPosition = current.taskPositions.get(task.id) ?? 0;
        if (
            !before ||
            before.status !== task.status ||
            previousPosition !== nextPosition
        ) {
            updates.push({
                id: task.id,
                position: nextPosition,
                status: task.status,
            });
        }
    }

    return updates;
}

function extractStatusTransition(
    activityChanges: TaskActivityChange[]
): null | { from: IdNameSnapshot; to: IdNameSnapshot } {
    const change = activityChanges.find((entry) => entry.field === "status");
    if (!change) return null;
    if (!isIdNameSnapshot(change.from) || !isIdNameSnapshot(change.to)) {
        return null;
    }
    return { from: change.from, to: change.to };
}

function isIdNameSnapshot(value: unknown): value is IdNameSnapshot {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as { id?: unknown; name?: unknown };
    return typeof snapshot.id === "string" && typeof snapshot.name === "string";
}

async function notifyBoardMoveBestEffort(input: {
    activityChanges: TaskActivityChange[];
    projectId: string;
    taskId: string;
}) {
    const event = planBoardMoveWatcherNotification(input.activityChanges);
    if (!event) return;

    try {
        await createNotificationsForWatchers({
            kind: "board_move",
            metadata: event.metadata,
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary task mutation.
    }
}

async function notifyDeadlineChangeBestEffort(input: {
    activityChanges: TaskActivityChange[];
    projectId: string;
    taskId: string;
}) {
    const event = planDeadlineWatcherNotification(input.activityChanges);
    if (!event) return;

    try {
        await createNotificationsForWatchers({
            kind: "deadline_change",
            metadata: event.metadata,
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary task mutation.
    }
}

async function notifyPersonFieldChangesBestEffort(input: {
    activityChanges: TaskActivityChange[];
    authorChange?: AuthorNotificationChange | null;
    projectId: string;
    taskId: string;
}) {
    const events = [
        ...planAssigneeChangeNotifications(input.activityChanges),
        ...planAuthorChangeNotifications(
            input.authorChange ? [input.authorChange] : []
        ),
    ];
    if (events.length === 0) return;

    try {
        await createTaskNotifications({
            events,
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary task mutation.
    }
}

async function notifyPriorityChangeBestEffort(input: {
    activityChanges: TaskActivityChange[];
    projectId: string;
    taskId: string;
}) {
    const event = planPriorityWatcherNotification(input.activityChanges);
    if (!event) return;

    try {
        await createNotificationsForWatchers({
            kind: "priority_change",
            metadata: event.metadata,
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary task mutation.
    }
}

async function notifyStatusChangeBestEffort(input: {
    activityChanges: TaskActivityChange[];
    projectId: string;
    taskId: string;
}) {
    const transition = extractStatusTransition(input.activityChanges);
    if (!transition) return;

    try {
        await createNotificationsForStatusChange({
            metadata: {
                from: transition.from,
                source: "app",
                to: transition.to,
            },
            projectId: input.projectId,
            taskId: input.taskId,
        });
    } catch {
        // Best-effort: never block the primary task mutation.
    }
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
