import type { Task, TaskPriority } from "../model/types";

import { isDeadlineOverdue } from "./format-deadline";

export type BoardTaskFilters = {
    deadlines: DeadlineFilterValue[];
    labelIds: string[];
    priorities: PriorityFilterValue[];
};

export type DeadlineFilterValue =
    | "later"
    | "none"
    | "overdue"
    | "thisWeek"
    | "today";

export type PriorityFilterValue = "none" | TaskPriority;

export const EMPTY_BOARD_FILTERS: BoardTaskFilters = {
    deadlines: [],
    labelIds: [],
    priorities: [],
};

export const DEADLINE_FILTER_VALUES: DeadlineFilterValue[] = [
    "overdue",
    "today",
    "thisWeek",
    "later",
    "none",
];

/** AND across filter groups; OR within each group. Empty group = no restriction. */
export function filterTasks(
    tasks: Task[],
    filters: BoardTaskFilters,
    now = new Date(),
): Task[] {
    if (!isBoardFiltersActive(filters)) return tasks;
    return tasks.filter((task) => matchesTaskFilters(task, filters, now));
}

export function isBoardFiltersActive(filters: BoardTaskFilters): boolean {
    return (
        filters.deadlines.length > 0 ||
        filters.labelIds.length > 0 ||
        filters.priorities.length > 0
    );
}

export function matchesTaskFilters(
    task: Task,
    filters: BoardTaskFilters,
    now = new Date(),
): boolean {
    if (
        filters.priorities.length > 0 &&
        !matchesPriority(task, filters.priorities)
    ) {
        return false;
    }

    if (
        filters.deadlines.length > 0 &&
        !matchesDeadline(task, filters.deadlines, now)
    ) {
        return false;
    }

    if (
        filters.labelIds.length > 0 &&
        !matchesLabels(task, filters.labelIds)
    ) {
        return false;
    }

    return true;
}

export function toggleFilterValue<T extends string>(
    values: T[],
    value: T,
): T[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}

function isDeadlineLater(isoDate: string, now: Date): boolean {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    return isoDate > toIsoDate(end);
}

/** Inclusive window: today → +6 days (rolling week). */
function isDeadlineThisWeek(isoDate: string, now: Date): boolean {
    if (isDeadlineOverdue(isoDate, now)) return false;

    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);
    return isoDate <= toIsoDate(end);
}

function isDeadlineToday(isoDate: string, now: Date): boolean {
    return isoDate === toIsoDate(now);
}

function matchesDeadline(
    task: Task,
    deadlines: DeadlineFilterValue[],
    now: Date,
): boolean {
    return deadlines.some((filter) => matchesDeadlineFilter(task, filter, now));
}

function matchesDeadlineFilter(
    task: Task,
    filter: DeadlineFilterValue,
    now: Date,
): boolean {
    if (filter === "none") return task.deadline === undefined;

    if (!task.deadline) return false;

    switch (filter) {
        case "later": {
            return isDeadlineLater(task.deadline, now);
        }
        case "overdue": {
            return isDeadlineOverdue(task.deadline, now);
        }
        case "thisWeek": {
            return isDeadlineThisWeek(task.deadline, now);
        }
        case "today": {
            return isDeadlineToday(task.deadline, now);
        }
    }
}

function matchesLabels(task: Task, labelIds: string[]): boolean {
    const taskLabels = task.labelIds ?? [];
    return labelIds.some((id) => taskLabels.includes(id));
}

function matchesPriority(
    task: Task,
    priorities: PriorityFilterValue[],
): boolean {
    const value: PriorityFilterValue = task.priority ?? "none";
    return priorities.includes(value);
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
