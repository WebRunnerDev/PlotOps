import type { TaskPriority, TaskType } from "@/features/tasks/model/types";

import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

const CREATE_PREFIX = "plotops:task-draft:create:";
const CREATE_BACKLOG_PREFIX = "plotops:task-draft:create-backlog:";

const TASK_TYPES = new Set<TaskType>(["bug", "feature", "task"]);
const TASK_PRIORITIES = new Set<TaskPriority>([
    "high",
    "low",
    "medium",
    "urgent",
]);

export type CreateTaskDraft = CreateTaskDraftMeta & {
    title: string;
    updatedAt: number;
    /** v1 = title only; v2 = title + optional quick-add meta. */
    v: 1 | 2;
};

/** Metadata selectable in column / backlog quick-add (persisted with title). */
export type CreateTaskDraftMeta = {
    assigneeId?: null | string;
    labelIds?: string[];
    priority?: null | TaskPriority;
    type?: TaskType;
};

export function clearCreateBacklogTaskDraft(
    boardId: string,
    sprintId: null | string
): void {
    safeRemoveItem(
        "sessionStorage",
        createBacklogTaskDraftKey(boardId, sprintId)
    );
}

export function clearCreateTaskDraft(boardId: string, status: string): void {
    safeRemoveItem("sessionStorage", createTaskDraftKey(boardId, status));
}

/** Draft key per Backlog page section (backlog or a planning sprint). */
export function createBacklogTaskDraftKey(
    boardId: string,
    sprintId: null | string
): string {
    return `${CREATE_BACKLOG_PREFIX}${boardId}:${sprintId ?? "none"}`;
}

export function createTaskDraftKey(boardId: string, status: string): string {
    return `${CREATE_PREFIX}${boardId}:${status}`;
}

export function getCreateBacklogTaskDraft(
    boardId: string,
    sprintId: null | string
): CreateTaskDraft | null {
    return parseCreateDraft(
        safeGetItem(
            "sessionStorage",
            createBacklogTaskDraftKey(boardId, sprintId)
        )
    );
}

export function getCreateTaskDraft(
    boardId: string,
    status: string
): CreateTaskDraft | null {
    return parseCreateDraft(
        safeGetItem("sessionStorage", createTaskDraftKey(boardId, status))
    );
}

export function setCreateBacklogTaskDraft(
    boardId: string,
    sprintId: null | string,
    title: string,
    meta?: CreateTaskDraftMeta
): void {
    persistCreateDraft(
        createBacklogTaskDraftKey(boardId, sprintId),
        title,
        meta
    );
}

export function setCreateTaskDraft(
    boardId: string,
    status: string,
    title: string,
    meta?: CreateTaskDraftMeta
): void {
    persistCreateDraft(createTaskDraftKey(boardId, status), title, meta);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAssigneeId(value: unknown): null | string | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string" && value.length > 0) return value;
    return undefined;
}

function parseCreateDraft(raw: null | string): CreateTaskDraft | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return null;
        if (parsed.v !== 1 && parsed.v !== 2) return null;
        if (typeof parsed.title !== "string") return null;
        if (typeof parsed.updatedAt !== "number") return null;
        const title = parsed.title.trim();
        if (!title) return null;

        if (parsed.v === 1) {
            return { title, updatedAt: parsed.updatedAt, v: 1 };
        }

        const meta = parseMeta(parsed);
        return {
            ...meta,
            title,
            updatedAt: parsed.updatedAt,
            v: 2,
        };
    } catch {
        return null;
    }
}

function parseLabelIds(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;
    const ids = value.filter(
        (item): item is string => typeof item === "string" && item.length > 0
    );
    return ids;
}

function parseMeta(parsed: Record<string, unknown>): CreateTaskDraftMeta {
    const meta: CreateTaskDraftMeta = {};

    if (
        typeof parsed.type === "string" &&
        TASK_TYPES.has(parsed.type as TaskType)
    ) {
        meta.type = parsed.type as TaskType;
    }

    if (parsed.priority === null) {
        meta.priority = null;
    } else if (
        typeof parsed.priority === "string" &&
        TASK_PRIORITIES.has(parsed.priority as TaskPriority)
    ) {
        meta.priority = parsed.priority as TaskPriority;
    }

    const assigneeId = parseAssigneeId(parsed.assigneeId);
    if (assigneeId !== undefined) {
        meta.assigneeId = assigneeId;
    }

    const labelIds = parseLabelIds(parsed.labelIds);
    if (labelIds !== undefined) {
        meta.labelIds = labelIds;
    }

    return meta;
}

function persistCreateDraft(
    key: string,
    title: string,
    meta?: CreateTaskDraftMeta
): void {
    const trimmed = title.trim();
    if (!trimmed) {
        safeRemoveItem("sessionStorage", key);
        return;
    }
    const draft: CreateTaskDraft = {
        title: trimmed.slice(0, TASK_TITLE_MAX_LENGTH),
        updatedAt: Date.now(),
        v: 2,
        ...(meta?.type === undefined ? {} : { type: meta.type }),
        ...(meta && "priority" in meta ? { priority: meta.priority } : {}),
        ...(meta && "assigneeId" in meta
            ? { assigneeId: meta.assigneeId }
            : {}),
        ...(meta && "labelIds" in meta
            ? { labelIds: meta.labelIds ?? [] }
            : {}),
    };
    safeSetItem("sessionStorage", key, JSON.stringify(draft));
}
