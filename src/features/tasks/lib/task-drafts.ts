import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

const CREATE_PREFIX = "plotops:task-draft:create:";

export type CreateTaskDraft = {
    title: string;
    updatedAt: number;
    v: 1;
};

export function clearCreateTaskDraft(boardId: string, status: string): void {
    safeRemoveItem("sessionStorage", createTaskDraftKey(boardId, status));
}

export function createTaskDraftKey(boardId: string, status: string): string {
    return `${CREATE_PREFIX}${boardId}:${status}`;
}

export function getCreateTaskDraft(
    boardId: string,
    status: string
): CreateTaskDraft | null {
    return parseCreateDraft(
        safeGetItem("sessionStorage", createTaskDraftKey(boardId, status))
    );
}

export function setCreateTaskDraft(
    boardId: string,
    status: string,
    title: string
): void {
    const trimmed = title.trim();
    const key = createTaskDraftKey(boardId, status);
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
