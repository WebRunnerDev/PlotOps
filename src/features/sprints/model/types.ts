/** Kanban board membership filter (not a domain entity). */
export type BoardSprintScope = "active" | "entire";

export type Sprint = {
    boardId: string;
    canceledAt?: string;
    closedAt?: string;
    committedTaskIds: string[];
    completedTaskIds: string[];
    createdAt: string;
    endsOn?: string;
    goal?: string;
    id: string;
    name: string;
    projectId: string;
    startedAt?: string;
    startsOn?: string;
    state: SprintState;
};

export type SprintEvent = {
    actorId?: string;
    createdAt: string;
    eventType: SprintEventType;
    id: string;
    payload: Record<string, unknown>;
    projectId: string;
    sprintId: string;
    taskId?: string;
};

export type SprintEventType =
    "canceled" | "closed" | "started" | "task_added" | "task_removed";

export type SprintState = "active" | "canceled" | "closed" | "draft";
