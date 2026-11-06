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
        /** Why the change happened, e.g. `repository_unlinked`. */
        reason?: string;
        /** Repository full name for Git link changes. */
        repository?: string;
    };
    projectId: string;
    taskId: string;
    user?: GuestPerson;
};

export type GuestBoard = {
    allowedHeadPatterns: string[];
    autoAssignToCreator?: boolean;
    columns: GuestBoardColumn[];
    defaultTaskType: "bug" | "story" | "task";
    id: string;
    /** Git branch mapping (Base branch + Allowed head patterns). */
    isDevelopment?: boolean;
    /** Set when `mergeTargetMode === "column"`; optional on older stored sessions. */
    mergeTargetColumnId?: null | string;
    /** After PR merge into Base branch; absent → `last_column`. */
    mergeTargetMode?: "column" | "last_column" | "none";
    name: string;
    position: number;
    projectId: string;
    /**
     * PR merge target per Repository (`board_repositories`); one row per
     * Project Repository while isDevelopment, empty otherwise.
     */
    repositoryBaseBranches: GuestBoardRepositoryBaseBranch[];
};

export type GuestBoardColumn = {
    id: string;
    isDone: boolean;
    name: string;
    position: number;
};

export type GuestBoardRepositoryBaseBranch = {
    baseBranch: string;
    repositoryId: string;
};

export type GuestComment = {
    author?: GuestPerson;
    body: string;
    createdAt: string;
    id: string;
    /** Thread root id when this Comment is a reply; null/undefined for roots. */
    parentId?: null | string;
    projectId: string;
    taskId: string;
    updatedAt: string;
};

/** Project-scoped custom text field definition (Guest sandbox). */
export type GuestCustomFieldDefinition = {
    appliesTo: Array<"bug" | "epic" | "story" | "task">;
    id: string;
    name: string;
    position: number;
    projectId: string;
    systemKey?: "description";
};

export type GuestCustomFieldValue = {
    fieldId: string;
    taskId: string;
    value: string;
};

/**
 * A repository the Guest's fake GitHub account can see — what the repo
 * pickers list in place of `GET /user/repos`.
 */
export type GuestGitHubRepo = {
    defaultBranch: string;
    description: null | string;
    fullName: string;
    htmlUrl: string;
    id: number;
    isPrivate: boolean;
    name: string;
};

/** A Task's branch / PR in one Repository (`task_git_links`, ADR 0036). */
export type GuestGitLink = {
    branchName?: string;
    /**
     * Stable id (`task_git_links.id`). Seeded and older links get one on read
     * (`guestGitLinkId`); links added in the session keep the app's id.
     */
    id?: string;
    pr?: GuestPullRequest;
    repositoryId: string;
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
    id: string;
    isPrivate: boolean;
    name: string;
    /** Linked GitHub repositories, oldest first; uncapped in Guest Mode. */
    repositories: GuestRepository[];
    slug: string;
    teamId: string;
    updatedAt: string;
};

export type GuestPullRequest = {
    number: number;
    state: "closed" | "merged" | "open";
    url: string;
};

/** A GitHub repository linked to a Guest Project (`project_repositories`). */
export type GuestRepository = {
    defaultBranch: string;
    fullName: string;
    githubRepoId: number;
    htmlUrl: string;
    id: string;
};

/** Full product seed clone held for the life of a Guest Session. */
export type GuestSandbox = {
    activity: GuestActivityEvent[];
    boards: GuestBoard[];
    comments: GuestComment[];
    customFieldDefinitions: GuestCustomFieldDefinition[];
    customFieldValues: GuestCustomFieldValue[];
    labels: GuestLabel[];
    notifications: GuestNotification[];
    projects: GuestProject[];
    sprints: GuestSprint[];
    taskLinks: GuestTaskLink[];
    tasks: GuestTask[];
    /** Sticky Watch rows (ADR 0028); optional on older stored sessions. */
    taskWatchers?: GuestTaskWatch[];
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
    /** ISO timestamp when the Task was created. */
    createdAt: string;
    /** ISO calendar date `YYYY-MM-DD`. */
    deadline?: string;
    description?: string;
    /** Badge colour; Epics only. */
    epicColor?:
        | "blue"
        | "gray"
        | "green"
        | "orange"
        | "pink"
        | "purple"
        | "red"
        | "teal"
        | "yellow";
    /** Epic this root Task belongs to (never on Epics or Subtasks). */
    epicId?: string;
    /** Fibonacci story points; absent = unestimated. */
    estimate?: 1 | 2 | 3 | 5 | 8 | 13 | 21;
    /** At most one per Repository, oldest first. */
    gitLinks?: GuestGitLink[];
    id: string;
    key: string;
    labelIds?: string[];
    linkedCommitSha?: string;
    /** Present when this Task is a Subtask of a Parent Task. */
    parentId?: string;
    position: number;
    priority?: "high" | "low" | "medium" | "urgent";
    projectId: string;
    sprintId?: string;
    sprintPosition?: number;
    status: string;
    title: string;
    type: "bug" | "epic" | "story" | "task";
};

export type GuestTaskLink = {
    id: string;
    kind: "blocks" | "relates_to";
    sourceTaskId: string;
    targetTaskId: string;
};

export type GuestTaskWatch = {
    taskId: string;
    userId: string;
};

export type GuestTeam = {
    createdAt: string;
    id: string;
    name: string;
    ownerId: string;
    updatedAt: string;
};
