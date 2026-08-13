import type {
    Task,
    TaskPriority,
    TaskPullRequest,
    TaskType,
} from "@/features/tasks/model/types";

import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { isTaskEstimate } from "@/features/tasks/lib/task-estimate";

export type DatabaseProfile = {
    avatar_url: null | string;
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

export type DatabaseTask = {
    archived_at: null | string;
    archived_by: null | string;
    archived_by_profile: DatabaseProfile | DatabaseProfile[] | null;
    assignee: DatabaseProfile | DatabaseProfile[] | null;
    assignee_id: null | string;
    author: DatabaseProfile | DatabaseProfile[] | null;
    author_id: null | string;
    board_id: string;
    branch_name: null | string;
    created_at: string;
    deadline: null | string;
    description: null | string;
    estimate: null | number;
    id: string;
    parent?: Array<{ task_key: string }> | null | { task_key: string };
    parent_id?: null | string;
    position: number;
    pr_number: null | number;
    pr_state: null | string;
    pr_url: null | string;
    priority: null | string;
    project_id: string;
    sprint_id: null | string;
    sprint_position: null | number;
    status: string;
    task_key: string;
    task_labels: Array<{ label_id: string }> | null;
    task_type: string;
    title: string;
};

const TASK_PRIORITIES = new Set<string>(["high", "low", "medium", "urgent"]);

const TASK_TYPES = new Set<string>(["bug", "feature", "task"]);

function toTaskType(value: null | string): TaskType {
    if (!value || !TASK_TYPES.has(value)) return "task";
    return value as TaskType;
}

const PR_STATES = new Set<string>(["closed", "merged", "open"]);

export function mapDatabaseTask(row: DatabaseTask): Task {
    const labelIds = row.task_labels?.map((item) => item.label_id) ?? [];
    const assignee = Array.isArray(row.assignee)
        ? row.assignee[0]
        : row.assignee;
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    const archivedBy = Array.isArray(row.archived_by_profile)
        ? row.archived_by_profile[0]
        : row.archived_by_profile;

    return {
        archivedAt: row.archived_at ?? undefined,
        archivedBy: toTaskPerson(archivedBy),
        assignee: toTaskPerson(assignee),
        author: toTaskPerson(author),
        boardId: row.board_id,
        branchName: row.branch_name ?? undefined,
        createdAt: row.created_at,
        deadline: row.deadline ?? undefined,
        description: row.description ?? undefined,
        estimate: isTaskEstimate(row.estimate) ? row.estimate : undefined,
        id: row.id,
        key: row.task_key,
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        parentId: row.parent_id ?? undefined,
        parentKey: toParentKey(row),
        pr: toPullRequest(row),
        priority: toTaskPriority(row.priority),
        sprintId: row.sprint_id ?? undefined,
        sprintPosition: row.sprint_position ?? undefined,
        status: row.status,
        title: row.title,
        type: toTaskType(row.task_type),
    };
}

export function sortTasksByPosition(
    tasks: Task[],
    positions: Map<string, number>
) {
    return [...tasks].toSorted(
        (left, right) =>
            (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0)
    );
}

function toParentKey(row: DatabaseTask): string | undefined {
    const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
    return parent?.task_key ?? undefined;
}

function toPullRequest(row: DatabaseTask): TaskPullRequest | undefined {
    if (row.pr_number == undefined || !row.pr_state || !row.pr_url)
        return undefined;
    if (!PR_STATES.has(row.pr_state)) return undefined;
    return {
        number: row.pr_number,
        state: row.pr_state as TaskPullRequest["state"],
        url: row.pr_url,
    };
}

function toTaskPerson(profile: DatabaseProfile | null | undefined) {
    if (!profile) return;
    const name = formatProfileDisplayName(profile);
    if (!name) return;
    return {
        avatarUrl: profile.avatar_url ?? undefined,
        id: profile.id,
        name,
    };
}

function toTaskPriority(value: null | string): TaskPriority | undefined {
    if (!value || !TASK_PRIORITIES.has(value)) return undefined;
    return value as TaskPriority;
}
