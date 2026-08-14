import type {
    GuestPerson,
    GuestSandbox,
    GuestTask,
} from "@/features/guest-mode";
import type { TaskRecordPatch } from "@/features/tasks/api/tasks-api";
import type { TasksProvider } from "@/features/tasks/api/tasks-provider";
import type {
    Task,
    TaskLinkPeer,
    TaskPriority,
    TaskType,
} from "@/features/tasks/model/types";

import {
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    updateGuestSandbox,
} from "@/features/guest-mode";
import { sortTasksByPosition } from "@/features/tasks/api/board-mappers";
import { isTaskEstimate } from "@/features/tasks/lib/task-estimate";
import {
    assertParentArchiveLegal,
    assertParentDeleteLegal,
    assertParentLinkLegal,
    assertTaskDoneLegal,
    assertTaskLinkLegal,
    hasOpenBlocker,
    PARENT_LINK_ERROR,
    type ParentGateTask,
    type TaskLinkEdge,
    type TaskLinkKind,
} from "@/features/tasks/lib/task-structure";
import {
    DEFAULT_TASK_PRIORITY,
    TASK_TITLE_MAX_LENGTH,
} from "@/features/tasks/model/constants";
import { resolveRestoreSubtaskSprintId } from "@/features/tasks/model/resolve-restore-subtask-sprint";
import { resolveRestoreTaskStatus } from "@/features/tasks/model/resolve-restore-task-status";

const ACTOR: GuestPerson = {
    id: GUEST_SEED_ACTOR_ID,
    name: "Demo Guest",
};

function appendParentActivity(
    sandbox: { activity: GuestSandbox["activity"] },
    input: {
        field: "parent" | "subtask";
        from: null | { key: string };
        projectId: string;
        taskId: string;
        to: null | { key: string };
    }
) {
    sandbox.activity.push({
        action: "updated",
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        metadata: {
            changes: [
                {
                    field: input.field,
                    from: input.from,
                    to: input.to,
                },
            ],
        },
        projectId: input.projectId,
        taskId: input.taskId,
        user: ACTOR,
    });
}

function appendTaskLinkActivity(
    sandbox: { activity: GuestSandbox["activity"] },
    input: {
        from: null | { key: string; kind: TaskLinkKind };
        projectId: string;
        taskId: string;
        to: null | { key: string; kind: TaskLinkKind };
    }
) {
    sandbox.activity.push({
        action: "updated",
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        metadata: {
            changes: [
                {
                    field: "task_link",
                    from: input.from,
                    to: input.to,
                },
            ],
        },
        projectId: input.projectId,
        taskId: input.taskId,
        user: ACTOR,
    });
}

function applyPatch(task: GuestTask, patch: TaskRecordPatch): void {
    if (patch.title !== undefined) {
        task.title = normalizeTaskTitle(patch.title);
    }
    if (patch.description !== undefined) {
        task.description = patch.description ?? undefined;
    }
    if (patch.priority !== undefined) {
        task.priority = (patch.priority as null | TaskPriority) ?? undefined;
    }
    if (patch.estimate !== undefined) {
        if (patch.estimate === null) {
            task.estimate = undefined;
        } else if (isTaskEstimate(patch.estimate)) {
            task.estimate = patch.estimate;
        } else {
            throw new Error("Estimate must be a Fibonacci story point");
        }
    }
    if (patch.deadline !== undefined) {
        task.deadline = patch.deadline ?? undefined;
    }
    if (patch.branch_name !== undefined) {
        task.branchName = patch.branch_name ?? undefined;
    }
    if (patch.status !== undefined) {
        task.status = patch.status;
    }
    if (patch.task_type !== undefined) {
        task.type = patch.task_type;
    }
    if (patch.position !== undefined) {
        task.position = patch.position;
    }
    if (patch.board_id !== undefined) {
        task.boardId = patch.board_id;
    }
    if (patch.assignee_id !== undefined) {
        task.assignee =
            patch.assignee_id === null
                ? undefined
                : patch.assignee_id === ACTOR.id
                  ? ACTOR
                  : { id: patch.assignee_id, name: "Member" };
    }
    if (patch.author_id !== undefined) {
        task.author =
            patch.author_id === null
                ? undefined
                : patch.author_id === ACTOR.id
                  ? ACTOR
                  : { id: patch.author_id, name: "Member" };
    }
    if (
        patch.pr_number !== undefined ||
        patch.pr_state !== undefined ||
        patch.pr_url !== undefined
    ) {
        if (
            patch.pr_number == undefined ||
            patch.pr_state == undefined ||
            patch.pr_url == undefined
        ) {
            task.pr = undefined;
        } else if (
            patch.pr_state === "open" ||
            patch.pr_state === "closed" ||
            patch.pr_state === "merged"
        ) {
            task.pr = {
                number: patch.pr_number,
                state: patch.pr_state,
                url: patch.pr_url,
            };
        }
    }
}

function assertDoneMoveLegal(
    sandbox: GuestSandbox,
    taskId: string,
    nextStatus: string,
    boardId: string
): void {
    const board = sandbox.boards.find((item) => item.id === boardId);
    const isDoneColumn =
        board?.columns.some(
            (column) => column.id === nextStatus && column.isDone
        ) === true;
    if (!isDoneColumn) return;
    assertTaskDoneLegal(
        taskId,
        parentGateTasks(sandbox),
        taskLinkEdges(sandbox)
    );
}

function findTaskOrThrow(tasks: GuestTask[], taskId: string): GuestTask {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
        throw new Error("Task not found");
    }
    return task;
}

function firstColumnId(board: {
    columns: Array<{ id: string; position: number }>;
}) {
    const ordered = [...board.columns].toSorted(
        (left, right) => left.position - right.position
    );
    const column = ordered[0];
    if (!column) {
        throw new Error("Board has no columns");
    }
    return column.id;
}

function isActiveTask(task: GuestTask): boolean {
    return task.archivedAt == undefined;
}

function mapGuestTask(task: GuestTask, sandbox: GuestSandbox): Task {
    const parent = task.parentId
        ? sandbox.tasks.find((item) => item.id === task.parentId)
        : undefined;
    return {
        archivedAt: task.archivedAt,
        assignee: task.assignee,
        author: task.author,
        boardId: task.boardId,
        branchName: task.branchName,
        createdAt: task.createdAt,
        deadline: task.deadline,
        description: task.description,
        estimate: task.estimate,
        hasOpenBlocker: hasOpenBlocker(
            task.id,
            parentGateTasks(sandbox),
            taskLinkEdges(sandbox)
        ),
        id: task.id,
        key: task.key,
        labelIds: task.labelIds,
        parentId: task.parentId,
        parentKey: parent?.key,
        pr: task.pr,
        priority: task.priority,
        relatedTasks: relatedPeersOf(task.id, sandbox),
        sprintId: task.sprintId,
        sprintPosition: task.sprintPosition,
        status: task.status,
        title: task.title,
        type: task.type,
    };
}

function maxPositionAmong(tasks: GuestTask[]): number {
    let max = -1;
    for (const task of tasks) {
        if (task.position > max) {
            max = task.position;
        }
    }
    return max;
}

function maxSprintPositionAmong(tasks: GuestTask[]): number {
    let max = -1;
    for (const task of tasks) {
        const position = task.sprintPosition ?? -1;
        if (position > max) {
            max = position;
        }
    }
    return max;
}

function nextTaskKey(tasks: GuestTask[], taskType: TaskType): string {
    const prefix =
        taskType === "bug" ? "BUG" : taskType === "feature" ? "FEAT" : "TASK";
    let max = 0;
    for (const task of tasks) {
        const match = new RegExp(String.raw`^${prefix}-(\d+)$`, "i").exec(
            task.key
        );
        if (match?.[1]) {
            max = Math.max(max, Number(match[1]));
        }
    }
    return `${prefix}-${max + 1}`;
}

function normalizeTaskTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) {
        throw new Error("Task title is required");
    }
    if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
        throw new Error(
            `Task title must be at most ${TASK_TITLE_MAX_LENGTH} characters`
        );
    }
    return trimmed;
}

function parentGateTasks(sandbox: GuestSandbox): ParentGateTask[] {
    const doneByBoard = new Map<string, Set<string>>();
    for (const board of sandbox.boards) {
        doneByBoard.set(
            board.id,
            new Set(
                board.columns
                    .filter((column) => column.isDone)
                    .map((column) => column.id)
            )
        );
    }
    return sandbox.tasks.map((task) => ({
        archivedAt: task.archivedAt,
        id: task.id,
        isDone: doneByBoard.get(task.boardId)?.has(task.status) === true,
        parentId: task.parentId,
    }));
}

function relatedPeersOf(
    taskId: string,
    sandbox: Pick<GuestSandbox, "taskLinks" | "tasks">
): TaskLinkPeer[] {
    const peers: TaskLinkPeer[] = [];
    for (const link of sandbox.taskLinks) {
        const otherId =
            link.sourceTaskId === taskId
                ? link.targetTaskId
                : link.targetTaskId === taskId
                  ? link.sourceTaskId
                  : undefined;
        if (!otherId) continue;
        const other = sandbox.tasks.find((item) => item.id === otherId);
        if (!other) continue;
        peers.push({
            direction: link.sourceTaskId === taskId ? "outgoing" : "incoming",
            id: link.id,
            kind: link.kind,
            otherId: other.id,
            otherKey: other.key,
            otherTitle: other.title,
        });
    }
    return peers;
}

function taskLinkEdges(
    sandbox: Pick<GuestSandbox, "taskLinks">
): TaskLinkEdge[] {
    return sandbox.taskLinks.map((link) => ({
        kind: link.kind,
        sourceId: link.sourceTaskId,
        targetId: link.targetTaskId,
    }));
}

/** Guest Mode Tasks adapter — mutates sessionStorage sandbox; never calls Supabase. */
export const guestTasksProvider: TasksProvider = {
    async archiveTaskRecord(taskId) {
        await guestTasksProvider.archiveTaskRecords([taskId]);
    },

    async archiveTaskRecords(taskIds) {
        const uniqueIds = [...new Set(taskIds.filter(Boolean))];
        let archivedCount = 0;
        updateGuestSandbox((sandbox) => {
            const gates = parentGateTasks(sandbox);
            for (const taskId of uniqueIds) {
                const task = sandbox.tasks.find((item) => item.id === taskId);
                if (!task || task.archivedAt) continue;
                assertParentArchiveLegal(taskId, gates);
            }
            const now = new Date().toISOString();
            for (const taskId of uniqueIds) {
                const task = sandbox.tasks.find((item) => item.id === taskId);
                if (!task || task.archivedAt) continue;
                task.archivedAt = now;
                archivedCount += 1;
            }
        });
        return { archivedCount };
    },

    async clearTaskParent(taskId) {
        let updated: GuestTask | undefined;

        updateGuestSandbox((sandbox) => {
            const task = findTaskOrThrow(sandbox.tasks, taskId);
            const previousParentId = task.parentId;
            if (previousParentId == undefined) {
                updated = task;
                return;
            }

            const parent = sandbox.tasks.find(
                (item) => item.id === previousParentId
            );
            const parentKey = parent?.key;
            const childKey = task.key;
            delete task.parentId;

            if (parent && parentKey) {
                appendParentActivity(sandbox, {
                    field: "subtask",
                    from: { key: childKey },
                    projectId: parent.projectId,
                    taskId: parent.id,
                    to: null,
                });
            }
            appendParentActivity(sandbox, {
                field: "parent",
                from: parentKey ? { key: parentKey } : null,
                projectId: task.projectId,
                taskId: task.id,
                to: null,
            });
            updated = task;
        });

        if (!updated) {
            throw new Error("Task not found");
        }
        return mapGuestTask(updated, getGuestSandbox()!);
    },

    async createSubtaskRecord(parentId, title, taskType, sprintId) {
        const normalizedTitle = normalizeTaskTitle(title);
        let created: GuestTask | undefined;

        updateGuestSandbox((sandbox) => {
            const parent = findTaskOrThrow(sandbox.tasks, parentId);
            if (parent.archivedAt) {
                throw new Error(PARENT_LINK_ERROR.parent_missing);
            }

            assertParentLinkLegal(
                { projectId: parent.projectId },
                {
                    id: parent.id,
                    parentId: parent.parentId,
                    projectId: parent.projectId,
                },
                sandbox.tasks.map((task) => ({
                    id: task.id,
                    parentId: task.parentId,
                    projectId: task.projectId,
                }))
            );

            const board = sandbox.boards.find(
                (item) => item.id === parent.boardId
            );
            if (!board) {
                throw new Error("Board not found");
            }

            const status = firstColumnId(board);
            const resolvedType = taskType ?? "task";
            const columnTasks = sandbox.tasks.filter(
                (task) =>
                    task.boardId === parent.boardId &&
                    task.status === status &&
                    isActiveTask(task)
            );
            const maxPosition = maxPositionAmong(columnTasks);

            const parentSprint = parent.sprintId
                ? sandbox.sprints.find(
                      (sprint) => sprint.id === parent.sprintId
                  )
                : undefined;
            const resolvedSprintId =
                sprintId ??
                (parentSprint?.state === "draft" ||
                parentSprint?.state === "active"
                    ? parent.sprintId
                    : undefined);

            let sprintPosition: number | undefined;
            if (resolvedSprintId) {
                const sprintTasks = sandbox.tasks.filter(
                    (task) =>
                        task.sprintId === resolvedSprintId && isActiveTask(task)
                );
                sprintPosition = maxSprintPositionAmong(sprintTasks) + 1;
            }

            created = {
                author: ACTOR,
                boardId: parent.boardId,
                createdAt: new Date().toISOString(),
                id: crypto.randomUUID(),
                key: nextTaskKey(sandbox.tasks, resolvedType),
                parentId: parent.id,
                position: maxPosition + 1,
                priority: DEFAULT_TASK_PRIORITY,
                projectId: parent.projectId,
                ...(resolvedSprintId
                    ? { sprintId: resolvedSprintId, sprintPosition }
                    : {}),
                status,
                title: normalizedTitle,
                type: resolvedType,
            };
            sandbox.tasks.push(created);

            appendParentActivity(sandbox, {
                field: "subtask",
                from: null,
                projectId: parent.projectId,
                taskId: parent.id,
                to: { key: created.key },
            });
            appendParentActivity(sandbox, {
                field: "parent",
                from: null,
                projectId: parent.projectId,
                taskId: created.id,
                to: { key: parent.key },
            });
        });

        if (!created) {
            throw new Error("Failed to create task");
        }
        return mapGuestTask(created, getGuestSandbox()!);
    },

    async createTaskLinkRecord(sourceTaskId, targetTaskId, kind) {
        let updated: GuestTask | undefined;

        updateGuestSandbox((sandbox) => {
            const source = findTaskOrThrow(sandbox.tasks, sourceTaskId);
            const target = findTaskOrThrow(sandbox.tasks, targetTaskId);
            assertTaskLinkLegal(
                sourceTaskId,
                targetTaskId,
                kind,
                sandbox.tasks.map((task) => ({
                    id: task.id,
                    parentId: task.parentId,
                    projectId: task.projectId,
                })),
                sandbox.taskLinks.map((link) => ({
                    kind: link.kind,
                    sourceId: link.sourceTaskId,
                    targetId: link.targetTaskId,
                }))
            );

            sandbox.taskLinks.push({
                id: crypto.randomUUID(),
                kind,
                sourceTaskId,
                targetTaskId,
            });

            appendTaskLinkActivity(sandbox, {
                from: null,
                projectId: source.projectId,
                taskId: source.id,
                to: { key: target.key, kind },
            });
            appendTaskLinkActivity(sandbox, {
                from: null,
                projectId: target.projectId,
                taskId: target.id,
                to: { key: source.key, kind },
            });
            updated = source;
        });

        if (!updated) {
            throw new Error("Task not found");
        }
        return mapGuestTask(updated, getGuestSandbox()!);
    },

    async createTaskRecord(
        projectId,
        boardId,
        status,
        title,
        taskType,
        sprintId
    ) {
        const normalizedTitle = normalizeTaskTitle(title);
        let created: GuestTask | undefined;

        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            const resolvedType =
                taskType ?? board.defaultTaskType ?? ("task" as const);

            const columnTasks = sandbox.tasks.filter(
                (task) =>
                    task.boardId === boardId &&
                    task.status === status &&
                    isActiveTask(task)
            );
            const maxPosition = maxPositionAmong(columnTasks);

            let sprintPosition: number | undefined;
            if (sprintId) {
                const sprintTasks = sandbox.tasks.filter(
                    (task) => task.sprintId === sprintId && isActiveTask(task)
                );
                sprintPosition = maxSprintPositionAmong(sprintTasks) + 1;
            }

            created = {
                author: ACTOR,
                boardId,
                createdAt: new Date().toISOString(),
                id: crypto.randomUUID(),
                key: nextTaskKey(sandbox.tasks, resolvedType),
                position: maxPosition + 1,
                priority: DEFAULT_TASK_PRIORITY,
                projectId,
                ...(sprintId ? { sprintId, sprintPosition } : {}),
                status,
                title: normalizedTitle,
                type: resolvedType,
            };
            sandbox.tasks.push(created);
        });

        if (!created) {
            throw new Error("Failed to create task");
        }
        return mapGuestTask(created, getGuestSandbox()!);
    },

    async deleteTaskLinkRecord(linkId) {
        updateGuestSandbox((sandbox) => {
            const link = sandbox.taskLinks.find((item) => item.id === linkId);
            if (!link) {
                throw new Error("Task Link not found");
            }
            const source = sandbox.tasks.find(
                (task) => task.id === link.sourceTaskId
            );
            const target = sandbox.tasks.find(
                (task) => task.id === link.targetTaskId
            );
            sandbox.taskLinks = sandbox.taskLinks.filter(
                (item) => item.id !== linkId
            );
            if (source && target) {
                appendTaskLinkActivity(sandbox, {
                    from: { key: target.key, kind: link.kind },
                    projectId: source.projectId,
                    taskId: source.id,
                    to: null,
                });
                appendTaskLinkActivity(sandbox, {
                    from: { key: source.key, kind: link.kind },
                    projectId: target.projectId,
                    taskId: target.id,
                    to: null,
                });
            }
        });
    },

    async deleteTaskRecord(taskId) {
        updateGuestSandbox((sandbox) => {
            findTaskOrThrow(sandbox.tasks, taskId);
            assertParentDeleteLegal(taskId, parentGateTasks(sandbox));
            sandbox.tasks = sandbox.tasks.filter((task) => task.id !== taskId);
            sandbox.comments = sandbox.comments.filter(
                (comment) => comment.taskId !== taskId
            );
            sandbox.activity = sandbox.activity.filter(
                (event) => event.taskId !== taskId
            );
            sandbox.taskLinks = sandbox.taskLinks.filter(
                (link) =>
                    link.sourceTaskId !== taskId && link.targetTaskId !== taskId
            );
            sandbox.notifications = sandbox.notifications.filter(
                (row) => row.taskId !== taskId
            );
            for (const sprint of sandbox.sprints) {
                sprint.committedTaskIds = sprint.committedTaskIds.filter(
                    (id) => id !== taskId
                );
                sprint.completedTaskIds = sprint.completedTaskIds.filter(
                    (id) => id !== taskId
                );
            }
        });
    },

    async fetchArchivedTasks(boardId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.tasks
            .filter((task) => task.boardId === boardId && !isActiveTask(task))
            .toSorted((a, b) => {
                const aTime = Date.parse(a.archivedAt!);
                const bTime = Date.parse(b.archivedAt!);
                return bTime - aTime;
            })
            .map((task) => mapGuestTask(task, sandbox));
    },

    async fetchBoardTasks(boardId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        const boardTasks = sandbox.tasks.filter(
            (task) => task.boardId === boardId && isActiveTask(task)
        );
        const tasks = boardTasks.map((task) => mapGuestTask(task, sandbox));
        const taskPositions = new Map(
            boardTasks.map((task) => [task.id, task.position] as const)
        );
        return {
            taskPositions,
            tasks: sortTasksByPosition(tasks, taskPositions),
        };
    },

    async fetchProjectTasks(projectId, options) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        const includeArchived = options?.includeArchived === true;
        return sandbox.tasks
            .filter(
                (task) =>
                    task.projectId === projectId &&
                    (includeArchived || isActiveTask(task))
            )
            .map((task) => mapGuestTask(task, sandbox));
    },

    async moveTaskToBoard(taskId, targetBoardId, targetStatus) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find(
                (item) => item.id === targetBoardId
            );
            if (!board) {
                throw new Error("Target board not found");
            }
            if (!board.columns.some((column) => column.id === targetStatus)) {
                throw new Error(
                    "Target column is not on the destination board"
                );
            }

            const task = findTaskOrThrow(sandbox.tasks, taskId);
            assertDoneMoveLegal(sandbox, taskId, targetStatus, targetBoardId);
            const columnTasks = sandbox.tasks.filter(
                (item) =>
                    item.boardId === targetBoardId &&
                    item.status === targetStatus &&
                    item.id !== taskId &&
                    isActiveTask(item)
            );

            task.boardId = targetBoardId;
            task.status = targetStatus;
            task.position = maxPositionAmong(columnTasks) + 1;
        });

        return { status: targetStatus };
    },

    async persistTaskMoves(boardId, updates) {
        if (updates.length === 0) return;

        updateGuestSandbox((sandbox) => {
            for (const update of updates) {
                const task = findTaskOrThrow(sandbox.tasks, update.id);
                if (task.boardId !== boardId) {
                    throw new Error("Task is not on this board");
                }
                if (task.status !== update.status) {
                    assertDoneMoveLegal(
                        sandbox,
                        update.id,
                        update.status,
                        boardId
                    );
                }
                task.status = update.status;
                task.position = update.position;
            }
        });
    },

    async restoreTaskRecord(taskId, boardId) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            const task = findTaskOrThrow(sandbox.tasks, taskId);
            if (!task.archivedAt) {
                return;
            }

            const columnIds = board.columns.map((column) => column.id);
            const status = resolveRestoreTaskStatus(task.status, columnIds);
            const columnTasks = sandbox.tasks.filter(
                (item) =>
                    item.boardId === boardId &&
                    item.status === status &&
                    item.id !== taskId &&
                    isActiveTask(item)
            );

            task.status = status;
            task.position = maxPositionAmong(columnTasks) + 1;
            delete task.archivedAt;

            const parent = task.parentId
                ? sandbox.tasks.find((item) => item.id === task.parentId)
                : undefined;
            const parentSprint = parent?.sprintId
                ? sandbox.sprints.find(
                      (sprint) => sprint.id === parent.sprintId
                  )
                : undefined;
            const restoredSprintId = resolveRestoreSubtaskSprintId({
                parentId: task.parentId,
                parentSprintId: parent?.sprintId,
                parentSprintIsLive:
                    parentSprint?.state === "draft" ||
                    parentSprint?.state === "active",
            });
            if (restoredSprintId) {
                const sprintTasks = sandbox.tasks.filter(
                    (item) =>
                        item.sprintId === restoredSprintId &&
                        item.id !== taskId &&
                        isActiveTask(item)
                );
                task.sprintId = restoredSprintId;
                task.sprintPosition = maxSprintPositionAmong(sprintTasks) + 1;
            }
        });
    },

    async updateTaskDetails(taskId, patch, labelIds) {
        updateGuestSandbox((sandbox) => {
            const task = findTaskOrThrow(sandbox.tasks, taskId);
            applyPatch(task, patch);
            if (labelIds !== undefined) {
                task.labelIds =
                    labelIds === null || labelIds.length === 0
                        ? undefined
                        : [...labelIds];
            }
        });
    },

    async updateTaskRecord(taskId, patch) {
        updateGuestSandbox((sandbox) => {
            const task = findTaskOrThrow(sandbox.tasks, taskId);
            if (patch.status !== undefined && patch.status !== task.status) {
                assertDoneMoveLegal(
                    sandbox,
                    taskId,
                    patch.status,
                    task.boardId
                );
            }
            applyPatch(task, patch);
        });
    },
};
