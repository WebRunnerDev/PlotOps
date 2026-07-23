/** Column id and task status are the same value — every status has a board column. */
export type BoardColumn = {
    id: TaskStatus;
    name: string;
};

/** @deprecated Import from `@/features/labels` — temporary shim. */
export type { LabelColor, ProjectLabel } from "@/features/labels/model/types";

export type Task = {
    archivedAt?: string;
    archivedBy?: TaskAssignee;
    assignee?: TaskAssignee;
    author?: TaskAssignee;
    boardId: string;
    branchName?: string;
    /** ISO calendar date `YYYY-MM-DD`. */
    deadline?: string;
    description?: string;
    id: string;
    /** Human-readable key, e.g. TASK-1, BUG-5, FEAT-12. Set by DB trigger on insert. */
    key: string;
    labelIds?: string[];
    pr?: TaskPullRequest;
    priority?: TaskPriority;
    /** Board Sprint membership; absent ⇒ Backlog. */
    sprintId?: string;
    /** Order within the Sprint section or Backlog. */
    sprintPosition?: number;
    status: TaskStatus;
    title: string;
    type: TaskType;
};

export type TaskActivityChange = {
    field: TaskActivityField;
    from: unknown;
    to: unknown;
};

export type TaskActivityEvent = {
    action: string;
    createdAt: string;
    id: string;
    metadata: TaskActivityMetadata;
    taskId: string;
    user?: TaskAssignee;
};

/** Fields included in the task activity feed (see SPEC — Task activity feed). */
export type TaskActivityField =
    | "archived"
    | "assignee"
    | "board"
    | "branch"
    | "deadline"
    | "labels"
    | "pr"
    | "priority"
    | "status"
    | "title"
    | "type";

export type TaskActivityMetadata = {
    changes: TaskActivityChange[];
};

export type TaskAssignee = {
    avatarUrl?: string;
    id: string;
    name: string;
};

export type TaskComment = {
    author?: TaskAssignee;
    body: string;
    createdAt: string;
    id: string;
    taskId: string;
    updatedAt: string;
};

export type TaskPriority = "high" | "low" | "medium" | "urgent";

export type TaskPullRequest = {
    number: number;
    state: "closed" | "merged" | "open";
    url: string;
};

export type TaskStatus = string;

export type TaskType = "bug" | "feature" | "task";
