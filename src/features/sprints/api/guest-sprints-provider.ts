import type { SprintsProvider } from "@/features/sprints/api/sprints-provider";
import type { Sprint } from "@/features/sprints/model/types";

import {
    getGuestSandbox,
    type GuestSandbox,
    type GuestSprint,
    type GuestTask,
    writeGuestSandbox,
} from "@/features/guest-mode";

/**
 * Guest Mode Sprint provider — reads/writes the session sandbox only.
 * No Supabase, Realtime, or notification fan-out.
 */
export const guestSprintsProvider: SprintsProvider = {
    async assignTasksToSprint(updates) {
        if (updates.length === 0) return;
        mutateSandbox((sandbox) => {
            for (const item of updates) {
                applyTaskSprintUpdate(sandbox, {
                    setSprintId: true,
                    sprintId: item.sprintId,
                    sprintPosition: item.sprintPosition,
                    taskId: item.taskId,
                });
            }
        });
    },

    async assignTaskToSprint(taskId, sprintId, sprintPosition) {
        mutateSandbox((sandbox) => {
            applyTaskSprintUpdate(sandbox, {
                setSprintId: true,
                sprintId,
                sprintPosition,
                taskId,
            });
        });
    },

    async cancelSprint(sprintId) {
        return mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "draft" && sprint.state !== "active") {
                throw new Error("Only draft or active sprints can be canceled");
            }

            sprint.state = "canceled";
            sprint.canceledAt = new Date().toISOString();

            for (const task of sandbox.tasks) {
                if (task.sprintId === sprintId) {
                    delete task.sprintId;
                    delete task.sprintPosition;
                }
            }

            return mapGuestSprint(sprint);
        });
    },

    async closeSprint(sprintId, completedTaskIds, carryoverByTaskId) {
        return mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "active") {
                throw new Error("Only active sprints can be closed");
            }

            const memberIds = sandbox.tasks
                .filter((task) => task.sprintId === sprintId)
                .map((task) => task.id);
            const memberSet = new Set(memberIds);
            const completed = completedTaskIds.filter((id) =>
                memberSet.has(id)
            );
            const completedSet = new Set(completed);
            const incomplete = memberIds.filter((id) => !completedSet.has(id));

            const nextPosBySprint = new Map<string, number>();
            const validatedTargets = new Set<string>();

            for (const taskId of incomplete) {
                const targetId = carryoverByTaskId[taskId] ?? null;
                if (!targetId || validatedTargets.has(targetId)) continue;

                const carry = findSprint(sandbox, targetId);
                if (carry.boardId !== sprint.boardId) {
                    throw new Error(
                        "Carryover sprint must be on the same board"
                    );
                }
                if (carry.state !== "draft") {
                    throw new Error("Carryover target must be a draft sprint");
                }

                let nextPos = -1;
                for (const task of sandbox.tasks) {
                    if (
                        task.sprintId === targetId &&
                        typeof task.sprintPosition === "number"
                    ) {
                        nextPos = Math.max(nextPos, task.sprintPosition);
                    }
                }
                nextPosBySprint.set(targetId, nextPos);
                validatedTargets.add(targetId);
            }

            sprint.state = "closed";
            sprint.completedTaskIds = completed;
            sprint.closedAt = new Date().toISOString();

            for (const taskId of completed) {
                const task = findTask(sandbox, taskId);
                delete task.sprintId;
                delete task.sprintPosition;
            }

            const ordered = incomplete
                .map((id) => findTask(sandbox, id))
                .toSorted(compareSprintMembers);

            for (const task of ordered) {
                const targetId = carryoverByTaskId[task.id] ?? null;
                if (targetId) {
                    const nextPos = (nextPosBySprint.get(targetId) ?? -1) + 1;
                    nextPosBySprint.set(targetId, nextPos);
                    task.sprintId = targetId;
                    task.sprintPosition = nextPos;
                } else {
                    delete task.sprintId;
                    delete task.sprintPosition;
                }
            }

            return mapGuestSprint(sprint);
        });
    },

    async createDraftSprint(boardId, projectId, name, goal) {
        return mutateSandbox((sandbox) => {
            const sprint: GuestSprint = {
                boardId,
                committedTaskIds: [],
                completedTaskIds: [],
                createdAt: new Date().toISOString(),
                goal: goal?.trim() || undefined,
                id: crypto.randomUUID(),
                name: name.trim(),
                projectId,
                state: "draft",
            };
            sandbox.sprints.unshift(sprint);
            return mapGuestSprint(sprint);
        });
    },

    async deleteEmptyDraftSprint(sprintId) {
        mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "draft") {
                throw new Error("Only draft sprints can be deleted this way");
            }
            sandbox.sprints = sandbox.sprints.filter(
                (item) => item.id !== sprintId
            );
        });
    },

    async deletePastSprint(sprintId) {
        mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "closed" && sprint.state !== "canceled") {
                throw new Error(
                    "Only closed or canceled sprints can be deleted"
                );
            }
            sandbox.sprints = sandbox.sprints.filter(
                (item) => item.id !== sprintId
            );
        });
    },

    async fetchBoardSprints(boardId) {
        const sandbox = requireSandbox();
        return sandbox.sprints
            .filter((sprint) => sprint.boardId === boardId)
            .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((sprint) => mapGuestSprint(sprint));
    },

    async fetchSprintEvents() {
        // Static seed Activity/Notifications only — no local event fan-out.
        requireSandbox();
        return [];
    },

    async reorderSprintMembership(updates) {
        if (updates.length === 0) return;
        mutateSandbox((sandbox) => {
            for (const item of updates) {
                applyTaskSprintUpdate(sandbox, {
                    setSprintId: false,
                    sprintId: null,
                    sprintPosition: item.sprintPosition,
                    taskId: item.id,
                });
            }
        });
    },

    async startSprint(sprintId, startsOn, endsOn) {
        return mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "draft") {
                throw new Error("Only draft sprints can be started");
            }
            if (!startsOn || !endsOn || startsOn > endsOn) {
                throw new Error(
                    "Active sprint requires valid start and end dates"
                );
            }
            if (
                sandbox.sprints.some(
                    (item) =>
                        item.boardId === sprint.boardId &&
                        item.state === "active"
                )
            ) {
                throw new Error("Board already has an active sprint");
            }

            const committed = sandbox.tasks
                .filter((task) => task.sprintId === sprintId)
                .toSorted(compareSprintMembers)
                .map((task) => task.id);

            sprint.state = "active";
            sprint.startsOn = startsOn;
            sprint.endsOn = endsOn;
            sprint.committedTaskIds = committed;
            sprint.startedAt = new Date().toISOString();
            sprint.completedTaskIds = [];
            delete sprint.closedAt;
            delete sprint.canceledAt;

            return mapGuestSprint(sprint);
        });
    },

    async updateDraftSprint(sprintId, patch) {
        mutateSandbox((sandbox) => {
            const sprint = findSprint(sandbox, sprintId);
            if (sprint.state !== "draft") {
                throw new Error("Only draft sprints can be updated");
            }
            if (patch.name !== undefined) {
                sprint.name = patch.name.trim();
            }
            if (patch.goal !== undefined) {
                const trimmed = patch.goal?.trim() || undefined;
                if (trimmed === undefined) {
                    delete sprint.goal;
                } else {
                    sprint.goal = trimmed;
                }
            }
        });
    },
};

function applyTaskSprintUpdate(
    sandbox: GuestSandbox,
    update: {
        setSprintId: boolean;
        sprintId: null | string;
        sprintPosition: null | number;
        taskId: string;
    }
): void {
    const task = findTask(sandbox, update.taskId);
    if (update.setSprintId) {
        if (update.sprintId === null) {
            delete task.sprintId;
        } else {
            task.sprintId = update.sprintId;
        }
        if (update.sprintPosition === null) {
            delete task.sprintPosition;
        } else {
            task.sprintPosition = update.sprintPosition;
        }
        return;
    }
    if (update.sprintPosition === null) {
        delete task.sprintPosition;
    } else {
        task.sprintPosition = update.sprintPosition;
    }
}

function compareSprintMembers(a: GuestTask, b: GuestTask): number {
    const posA = a.sprintPosition ?? Number.POSITIVE_INFINITY;
    const posB = b.sprintPosition ?? Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    return a.id.localeCompare(b.id);
}

function findSprint(sandbox: GuestSandbox, sprintId: string): GuestSprint {
    const sprint = sandbox.sprints.find((item) => item.id === sprintId);
    if (!sprint) {
        throw new Error("Sprint not found");
    }
    return sprint;
}

function findTask(sandbox: GuestSandbox, taskId: string): GuestTask {
    const task = sandbox.tasks.find((item) => item.id === taskId);
    if (!task) {
        throw new Error("Task not found");
    }
    return task;
}

function mapGuestSprint(sprint: GuestSprint): Sprint {
    return {
        boardId: sprint.boardId,
        canceledAt: sprint.canceledAt,
        closedAt: sprint.closedAt,
        committedTaskIds: [...sprint.committedTaskIds],
        completedTaskIds: [...sprint.completedTaskIds],
        createdAt: sprint.createdAt,
        endsOn: sprint.endsOn,
        goal: sprint.goal,
        id: sprint.id,
        name: sprint.name,
        projectId: sprint.projectId,
        startedAt: sprint.startedAt,
        startsOn: sprint.startsOn,
        state: sprint.state,
    };
}

function mutateSandbox<T>(function_: (sandbox: GuestSandbox) => T): T {
    const sandbox = requireSandbox();
    const result = function_(sandbox);
    writeGuestSandbox(sandbox);
    return result;
}

function requireSandbox(): GuestSandbox {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        throw new Error("Guest sandbox is not available");
    }
    return sandbox;
}
