import type { GuestPerson, GuestTask } from "@/features/guest-mode";
import type { TaskRecordPatch } from "@/features/tasks/api/tasks-api";
import type { TasksProvider } from "@/features/tasks/api/tasks-provider";
import type {
    Task,
    TaskPriority,
    TaskType,
} from "@/features/tasks/model/types";

import {
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    updateGuestSandbox,
} from "@/features/guest-mode";
import { sortTasksByPosition } from "@/features/tasks/api/board-mappers";
import {
    DEFAULT_TASK_PRIORITY,
    TASK_TITLE_MAX_LENGTH,
} from "@/features/tasks/model/constants";
import { resolveRestoreTaskStatus } from "@/features/tasks/model/resolve-restore-task-status";

const ACTOR: GuestPerson = {
    id: GUEST_SEED_ACTOR_ID,
    name: "Demo Guest",
};

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

function findTaskOrThrow(tasks: GuestTask[], taskId: string): GuestTask {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
        throw new Error("Task not found");
    }
    return task;
}

function isActiveTask(task: GuestTask): boolean {
    return task.archivedAt == undefined;
}

function mapGuestTask(task: GuestTask): Task {
    return {
        archivedAt: task.archivedAt,
        assignee: task.assignee,
        author: task.author,
        boardId: task.boardId,
        branchName: task.branchName,
        deadline: task.deadline,
        description: task.description,
        id: task.id,
        key: task.key,
        labelIds: task.labelIds,
        pr: task.pr,
        priority: task.priority,
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

/** Guest Mode Tasks adapter — mutates sessionStorage sandbox; never calls Supabase. */
export const guestTasksProvider: TasksProvider = {
    async archiveTaskRecord(taskId) {
        updateGuestSandbox((sandbox) => {
            const task = findTaskOrThrow(sandbox.tasks, taskId);
            if (task.archivedAt) {
                return;
            }
            task.archivedAt = new Date().toISOString();
        });
    },

    async createTaskRecord(
        projectId,
        boardId,
        status,
        title,
        taskType = "task",
        sprintId
    ) {
        const normalizedTitle = normalizeTaskTitle(title);
        let created: GuestTask | undefined;

        updateGuestSandbox((sandbox) => {
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
                id: crypto.randomUUID(),
                key: nextTaskKey(sandbox.tasks, taskType),
                position: maxPosition + 1,
                priority: DEFAULT_TASK_PRIORITY,
                projectId,
                ...(sprintId ? { sprintId, sprintPosition } : {}),
                status,
                title: normalizedTitle,
                type: taskType,
            };
            sandbox.tasks.push(created);
        });

        if (!created) {
            throw new Error("Failed to create task");
        }
        return mapGuestTask(created);
    },

    async deleteTaskRecord(taskId) {
        updateGuestSandbox((sandbox) => {
            findTaskOrThrow(sandbox.tasks, taskId);
            sandbox.tasks = sandbox.tasks.filter((task) => task.id !== taskId);
            sandbox.comments = sandbox.comments.filter(
                (comment) => comment.taskId !== taskId
            );
            sandbox.activity = sandbox.activity.filter(
                (event) => event.taskId !== taskId
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
            .map((task) => mapGuestTask(task));
    },

    async fetchBoardTasks(boardId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        const boardTasks = sandbox.tasks.filter(
            (task) => task.boardId === boardId && isActiveTask(task)
        );
        const tasks = boardTasks.map((task) => mapGuestTask(task));
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
            .map((task) => mapGuestTask(task));
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
            applyPatch(task, patch);
        });
    },
};
