/** Column id and task status are the same value — every status has a board column. */
export type BoardColumn = {
    id: TaskStatus;
    name: string;
};

export type LabelColor =
    | "amber"
    | "blue"
    | "cyan"
    | "gray"
    | "green"
    | "orange"
    | "pink"
    | "purple"
    | "red";

/** Project-scoped label. Future: copy/import labels across projects. */
export type ProjectLabel = {
    color: LabelColor;
    /** Custom hex color (`#rrggbb`). Overrides the `color` preset when set. */
    customColor?: string;
    id: string;
    name: string;
    projectId: string;
};

export type Task = {
    assignee?: TaskAssignee;
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
    status: TaskStatus;
    title: string;
    type: TaskType;
};

export type TaskType = "bug" | "feature" | "task";

export type TaskAssignee = {
    avatarUrl?: string;
    name: string;
};

export type TaskPriority = "high" | "low" | "medium" | "urgent";

export type TaskPullRequest = {
    number: number;
    state: "closed" | "merged" | "open";
    url: string;
};

export type TaskStatus = string;
