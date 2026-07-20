import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskPriority,
    TaskPullRequest,
    TaskType,
} from "@/features/tasks/model/types";

export type DbBoardColumn = {
    board_id: string;
    id: string;
    name: string;
    position: number;
    project_id: string;
};

export type DbLabel = {
    color: string;
    custom_color: string | null;
    id: string;
    name: string;
    project_id: string;
};

export type DbProfile = {
    avatar_url: string | null;
    id: string;
    username: string | null;
};

export type DbTask = {
    assignee: DbProfile | DbProfile[] | null;
    assignee_id: string | null;
    board_id: string;
    branch_name: string | null;
    created_at: string;
    deadline: string | null;
    description: string | null;
    id: string;
    position: number;
    pr_number: number | null;
    pr_state: string | null;
    pr_url: string | null;
    priority: string | null;
    project_id: string;
    status: string;
    task_key: string;
    task_labels: Array<{ label_id: string }> | null;
    task_type: string;
    title: string;
};

const LABEL_COLORS = new Set<string>([
    "amber",
    "blue",
    "cyan",
    "gray",
    "green",
    "orange",
    "pink",
    "purple",
    "red",
]);

const TASK_PRIORITIES = new Set<string>(["high", "low", "medium", "urgent"]);

const TASK_TYPES = new Set<string>(["bug", "feature", "task"]);

function toTaskType(value: string | null): TaskType {
    if (!value || !TASK_TYPES.has(value)) return "task";
    return value as TaskType;
}

const PR_STATES = new Set<string>(["closed", "merged", "open"]);

function toLabelColor(value: string): LabelColor {
    return LABEL_COLORS.has(value) ? (value as LabelColor) : "gray";
}

function toTaskPriority(value: string | null): TaskPriority | undefined {
    if (!value || !TASK_PRIORITIES.has(value)) return undefined;
    return value as TaskPriority;
}

function toPullRequest(row: DbTask): TaskPullRequest | undefined {
    if (row.pr_number == null || !row.pr_state || !row.pr_url) return undefined;
    if (!PR_STATES.has(row.pr_state)) return undefined;
    return {
        number: row.pr_number,
        state: row.pr_state as TaskPullRequest["state"],
        url: row.pr_url,
    };
}

export function mapDbColumn(row: DbBoardColumn): BoardColumn {
    return {
        id: row.id,
        name: row.name,
    };
}

export function mapDbLabel(row: DbLabel): ProjectLabel {
    return {
        color: toLabelColor(row.color),
        customColor: row.custom_color ?? undefined,
        id: row.id,
        name: row.name,
        projectId: row.project_id,
    };
}

export function mapDbTask(row: DbTask): Task {
    const labelIds = row.task_labels?.map((item) => item.label_id) ?? [];
    const assignee = Array.isArray(row.assignee)
        ? row.assignee[0]
        : row.assignee;

    return {
        assignee: assignee?.username
            ? {
                  avatarUrl: assignee.avatar_url ?? undefined,
                  name: assignee.username,
              }
            : undefined,
        boardId: row.board_id,
        branchName: row.branch_name ?? undefined,
        deadline: row.deadline ?? undefined,
        description: row.description ?? undefined,
        id: row.id,
        key: row.task_key,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        pr: toPullRequest(row),
        priority: toTaskPriority(row.priority),
        status: row.status,
        title: row.title,
        type: toTaskType(row.task_type),
    };
}

export function sortColumns(columns: BoardColumn[], positions: Map<string, number>) {
    return [...columns].sort(
        (left, right) =>
            (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );
}

export function sortTasksByPosition(tasks: Task[], positions: Map<string, number>) {
    return [...tasks].sort(
        (left, right) =>
            (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );
}
