import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

const CREATE_PREFIX = "plotops:task-draft:create:";
const CREATE_BACKLOG_PREFIX = "plotops:task-draft:create-backlog:";

export type CreateTaskDraft = {
    title: string;
    updatedAt: number;
    v: 1;
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
    title: string
): void {
    persistCreateDraft(createBacklogTaskDraftKey(boardId, sprintId), title);
}

export function setCreateTaskDraft(
    boardId: string,
    status: string,
    title: string
): void {
    persistCreateDraft(createTaskDraftKey(boardId, status), title);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCreateDraft(raw: null | string): CreateTaskDraft | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || parsed.v !== 1) return null;
        if (typeof parsed.title !== "string") return null;
        if (typeof parsed.updatedAt !== "number") return null;
        const title = parsed.title.trim();
        if (!title) return null;
        return { title, updatedAt: parsed.updatedAt, v: 1 };
    } catch {
        return null;
    }
}

function persistCreateDraft(key: string, title: string): void {
    const trimmed = title.trim();
    if (!trimmed) {
        safeRemoveItem("sessionStorage", key);
        return;
    }
    const draft: CreateTaskDraft = {
        title: trimmed.slice(0, TASK_TITLE_MAX_LENGTH),
        updatedAt: Date.now(),
        v: 1,
    };
    safeSetItem("sessionStorage", key, JSON.stringify(draft));
}
