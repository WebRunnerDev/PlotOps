/**
 * Local Guest Mode sandbox snapshot (sessionStorage).
 * Provider tickets map these shapes onto domain reads/writes.
 */

export type GuestActivityEvent = {
    action: string;
    createdAt: string;
    id: string;
    metadata: {
        changes: Array<{
            field: string;
            from: unknown;
            to: unknown;
        }>;
    };
    projectId: string;
    taskId: string;
    user?: GuestPerson;
};

export type GuestBoard = {
    allowedHeadPatterns: string[];
    autoAssignToCreator?: boolean;
    baseBranch: string;
    columns: GuestBoardColumn[];
    defaultTaskType: "bug" | "feature" | "task";
    id: string;
    name: string;
    position: number;
    projectId: string;
};

export type GuestBoardColumn = {
    id: string;
    isDone: boolean;
    name: string;
    position: number;
};

export type GuestComment = {
    author?: GuestPerson;
    body: string;
    createdAt: string;
    id: string;
    projectId: string;
    taskId: string;
    updatedAt: string;
};

export type GuestLabel = {
    color: string;
    /** Custom hex (`#rrggbb`); overrides the preset when set. */
    customColor?: string;
    id: string;
    name: string;
    projectId: string;
};

export type GuestNotification = {
    createdAt: string;
    id: string;
    kind: string;
    metadata: Record<string, unknown>;
    projectId: string;
    readAt: null | string;
    taskId: string;
    taskKey: string;
    taskTitle: string;
};

export type GuestPerson = {
    avatarUrl?: string;
    id: string;
    name: string;
};

export type GuestProject = {
    createdAt: string;
    description: null | string;
    githubDefaultBranch: null | string;
    githubFullName: null | string;
    githubHtmlUrl: null | string;
    githubRepoId: null | number;
    id: string;
    isPrivate: boolean;
    name: string;
    slug: string;
    teamId: string;
    updatedAt: string;
};

export type GuestPullRequest = {
    number: number;
    state: "closed" | "merged" | "open";
    url: string;
};

/** Full product seed clone held for the life of a Guest Session. */
export type GuestSandbox = {
    activity: GuestActivityEvent[];
    boards: GuestBoard[];
    comments: GuestComment[];
    labels: GuestLabel[];
    notifications: GuestNotification[];
    projects: GuestProject[];
    sprints: GuestSprint[];
    taskLinks: GuestTaskLink[];
    tasks: GuestTask[];
    teams: GuestTeam[];
};

export type GuestSprint = {
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
    state: "active" | "canceled" | "closed" | "draft";
};

export type GuestTask = {
    /** ISO timestamp when archived; absent ⇒ active on the Board. */
    archivedAt?: string;
    assignee?: GuestPerson;
    author?: GuestPerson;
    boardId: string;
    branchName?: string;
    /** ISO timestamp when the Task was created. */
    createdAt: string;
    /** ISO calendar date `YYYY-MM-DD`. */
    deadline?: string;
    description?: string;
    /** Fibonacci story points; absent = unestimated. */
    estimate?: 1 | 2 | 3 | 5 | 8 | 13 | 21;
    id: string;
    key: string;
    labelIds?: string[];
    linkedCommitSha?: string;
    /** Present when this Task is a Subtask of a Parent Task. */
    parentId?: string;
    position: number;
    pr?: GuestPullRequest;
    priority?: "high" | "low" | "medium" | "urgent";
    projectId: string;
    sprintId?: string;
    sprintPosition?: number;
    status: string;
    title: string;
    type: "bug" | "feature" | "task";
};

export type GuestTaskLink = {
    id: string;
    kind: "blocks" | "relates_to";
    sourceTaskId: string;
    targetTaskId: string;
};

export type GuestTeam = {
    createdAt: string;
    id: string;
    name: string;
    ownerId: string;
    updatedAt: string;
};
