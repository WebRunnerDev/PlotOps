import {
    type BoardSortDirection,
    type BoardSortField,
    isDeadlineOverdue,
    sortTasksByBoardSort,
    type TeamTask,
    toIsoDate,
} from "@/features/tasks";

/** Assignee filter sentinel: Tasks assigned to the viewer. */
export const ME_ASSIGNEE_FILTER = "me";

/** Assignee filter sentinel: no Assignee restriction. */
export const ANY_ASSIGNEE_FILTER = "any";

/** Assignee filter sentinel: Tasks with no Assignee. */
export const UNASSIGNED_ASSIGNEE_FILTER = "none";

export type TeamTasksDeadlineBucket = "later" | "none" | "overdue" | "thisWeek";

export type TeamTasksGroup = {
    /** Stable id — a Project id, Assignee id, Deadline bucket, or sentinel. */
    key: string;
    kind: TeamTasksGroupBy;
    /** Project / Assignee name; absent when the label is a translated sentinel. */
    label?: string;
    tasks: TeamTask[];
};

export type TeamTasksGroupBy = "assignee" | "deadline" | "none" | "project";

/** Per-viewer Team Tasks display preferences (grouping, sort, filters). */
export type TeamTasksPreferences = {
    /** A profile id or one of the `*_ASSIGNEE_FILTER` sentinels. */
    assignee: string;
    groupBy: TeamTasksGroupBy;
    /** Hide Tasks in their Board's Done column. */
    hideDone: boolean;
    /** Empty = every Project of the Team. */
    projectIds: string[];
    sort: TeamTasksSort;
};

export type TeamTasksSort = {
    direction: BoardSortDirection;
    field: TeamTasksSortField;
};

export type TeamTasksSortField = Extract<
    BoardSortField,
    "created" | "deadline" | "priority"
>;

export const TEAM_TASKS_SORT_FIELDS: TeamTasksSortField[] = [
    "deadline",
    "priority",
    "created",
];

export const TEAM_TASKS_GROUP_BY: TeamTasksGroupBy[] = [
    "project",
    "assignee",
    "deadline",
    "none",
];

/** "Assigned to me, not Done, soonest Deadline first, grouped by Project". */
export const DEFAULT_TEAM_TASKS_PREFERENCES: TeamTasksPreferences = {
    assignee: ME_ASSIGNEE_FILTER,
    groupBy: "project",
    hideDone: true,
    projectIds: [],
    sort: { direction: "asc", field: "deadline" },
};

const DEADLINE_BUCKET_ORDER: TeamTasksDeadlineBucket[] = [
    "overdue",
    "thisWeek",
    "later",
    "none",
];

/** Filter → sort → group. Empty groups are dropped. */
export function buildTeamTasksGroups(
    tasks: TeamTask[],
    preferences: TeamTasksPreferences,
    context: { currentUserId: null | string | undefined; now?: Date }
): TeamTasksGroup[] {
    const filtered = filterTeamTasks(tasks, preferences, context.currentUserId);
    const sorted = sortTasksByBoardSort(filtered, preferences.sort);
    return groupTeamTasks(sorted, preferences.groupBy, context.now);
}

export function filterTeamTasks(
    tasks: TeamTask[],
    preferences: Pick<
        TeamTasksPreferences,
        "assignee" | "hideDone" | "projectIds"
    >,
    currentUserId?: null | string
): TeamTask[] {
    const projectIds = new Set(preferences.projectIds);

    return tasks.filter((task) => {
        if (preferences.hideDone && task.isDone) return false;
        if (projectIds.size > 0 && !projectIds.has(task.projectId)) {
            return false;
        }
        return matchesAssignee(task, preferences.assignee, currentUserId);
    });
}

/**
 * Split already-sorted Tasks into groups, keeping the sort inside each group.
 * Projects and Assignees order by name (Unassigned last); Deadline buckets run
 * overdue → this week → later → none.
 */
export function groupTeamTasks(
    tasks: TeamTask[],
    groupBy: TeamTasksGroupBy,
    now = new Date()
): TeamTasksGroup[] {
    if (tasks.length === 0) return [];
    if (groupBy === "none") {
        return [{ key: "all", kind: "none", tasks }];
    }

    const groups = new Map<string, TeamTasksGroup>();
    for (const task of tasks) {
        const { key, label } = groupOf(task, groupBy, now);
        const group = groups.get(key);
        if (group) {
            group.tasks.push(task);
        } else {
            groups.set(key, { key, kind: groupBy, label, tasks: [task] });
        }
    }

    const list = [...groups.values()];
    if (groupBy === "deadline") {
        return list.toSorted(
            (left, right) =>
                DEADLINE_BUCKET_ORDER.indexOf(
                    left.key as TeamTasksDeadlineBucket
                ) -
                DEADLINE_BUCKET_ORDER.indexOf(
                    right.key as TeamTasksDeadlineBucket
                )
        );
    }
    return list.toSorted((left, right) => {
        if (left.label === undefined) return 1;
        if (right.label === undefined) return -1;
        return left.label.localeCompare(right.label);
    });
}

/** Rolling week, matching the Board Deadline filter: today → +6 days. */
export function teamTaskDeadlineBucket(
    deadline: string | undefined,
    now = new Date()
): TeamTasksDeadlineBucket {
    if (!deadline) return "none";
    if (isDeadlineOverdue(deadline, now)) return "overdue";

    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    return deadline <= toIsoDate(end) ? "thisWeek" : "later";
}

function groupOf(
    task: TeamTask,
    groupBy: Exclude<TeamTasksGroupBy, "none">,
    now: Date
): { key: string; label?: string } {
    switch (groupBy) {
        case "assignee": {
            return task.assignee
                ? { key: task.assignee.id, label: task.assignee.name }
                : { key: UNASSIGNED_ASSIGNEE_FILTER };
        }
        case "deadline": {
            return { key: teamTaskDeadlineBucket(task.deadline, now) };
        }
        case "project": {
            return { key: task.projectId, label: task.projectName };
        }
    }
}

function matchesAssignee(
    task: TeamTask,
    assignee: string,
    currentUserId: null | string | undefined
): boolean {
    switch (assignee) {
        case ANY_ASSIGNEE_FILTER: {
            return true;
        }
        case ME_ASSIGNEE_FILTER: {
            return (
                Boolean(currentUserId) && task.assignee?.id === currentUserId
            );
        }
        case UNASSIGNED_ASSIGNEE_FILTER: {
            return task.assignee === undefined;
        }
        default: {
            return task.assignee?.id === assignee;
        }
    }
}
