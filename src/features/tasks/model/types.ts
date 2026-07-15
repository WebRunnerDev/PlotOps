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
    id: string;
    name: string;
    projectId: string;
};

export type Task = {
    assignee?: TaskAssignee;
    branchName?: string;
    /** ISO calendar date `YYYY-MM-DD`. */
    deadline?: string;
    description?: string;
    id: string;
    labelIds?: string[];
    pr?: TaskPullRequest;
    priority?: TaskPriority;
    status: TaskStatus;
    title: string;
};

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
