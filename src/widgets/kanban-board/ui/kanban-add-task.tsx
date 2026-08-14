import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    TASK_TITLE_MAX_LENGTH,
    type TaskStatus,
    useBoardTasks,
    useTasksUiStore,
} from "@/features/tasks";
import {
    clearCreateTaskDraft,
    getCreateTaskDraft,
    setCreateTaskDraft,
} from "@/features/tasks/lib/task-drafts";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { resolveBoardNewTaskCtaVisible } from "@/widgets/kanban-board/model/resolve-board-new-task-cta-visible";

type KanbanAddTaskProperties = {
    boardId: string;
    /** Sprint to join on create when board is scoped to Active Sprint. */
    createSprintId?: string;
    projectId: string;
    /** Open the inline composer (e.g. board chrome + New Task). */
    startOpen?: boolean;
    status: TaskStatus;
};

export function KanbanAddTask({
    boardId,
    createSprintId,
    projectId,
    startOpen = false,
    status,
}: KanbanAddTaskProperties) {
    const { t } = useTranslation("board");
    const { createTask } = useBoardTasks(projectId, boardId);
    const { canCreateTasks, isSettled } = useProjectAccess(projectId);
    const canCreate = resolveBoardNewTaskCtaVisible({
        canCreateTasks,
        isSettled,
    });
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(startOpen);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftTitle, setDraftTitle] = useState<null | string>(() => {
        return getCreateTaskDraft(boardId, status)?.title ?? null;
    });
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurSubmit = useRef(false);

    useEffect(() => {
        setDraftTitle(getCreateTaskDraft(boardId, status)?.title ?? null);
    }, [boardId, status]);

    useEffect(() => {
        if (!startOpen) return;
        setOpen(true);
        // Re-focus even when the composer was already open.
        queueMicrotask(() => {
            inputReference.current?.focus();
        });
    }, [startOpen]);

    useEffect(() => {
        if (!open) return;
        const draft = getCreateTaskDraft(boardId, status);
        if (draft) {
            setTitle(draft.title);
            setDraftTitle(draft.title);
        }
        inputReference.current?.focus();
    }, [boardId, open, status]);

    const closeComposer = () => {
        const trimmed = title.trim();
        if (trimmed) {
            setCreateTaskDraft(boardId, status, trimmed);
            setDraftTitle(trimmed);
        } else {
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
        }
        setOpen(false);
        setTitle("");
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
            setOpen(false);
            setTitle("");
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const task = await createTask(status, trimmed, {
                sprintId: createSprintId,
            });
            clearCreateTaskDraft(boardId, status);
            setDraftTitle(null);
            selectTask(task.id);
            setOpen(false);
            setTitle("");
        } catch {
            toast.error(t("tasks.createFailed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canCreate) {
        return null;
    }

    if (!open) {
        return (
            <Button
                className="h-9 w-full justify-start gap-2 text-muted-foreground sm:h-8"
                onClick={() => setOpen(true)}
                type="button"
                variant="ghost"
            >
                <Plus className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                    {draftTitle ?? t("tasks.add")}
                </span>
                {draftTitle ? (
                    <Badge
                        className="shrink-0 rounded-sm font-mono text-[0.625rem]"
                        variant="outline"
                    >
                        {t("tasks.draft")}
                    </Badge>
                ) : null}
            </Button>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1">
            {draftTitle || title.trim() ? (
                <div className="flex justify-end">
                    <Badge
                        className="rounded-sm font-mono text-[0.625rem]"
                        variant="outline"
                    >
                        {t("tasks.unsaved")}
                    </Badge>
                </div>
            ) : null}
            <Input
                aria-label={t("tasks.addPlaceholder")}
                className="h-8 bg-background text-ui shadow-none"
                disabled={isSubmitting}
                maxLength={TASK_TITLE_MAX_LENGTH}
                onBlur={() => {
                    if (skipBlurSubmit.current) {
                        skipBlurSubmit.current = false;
                        return;
                    }
                    // Persist draft on accidental blur/navigation; create only on Enter.
                    closeComposer();
                }}
                onChange={(event) => {
                    const next = event.target.value;
                    setTitle(next);
                    if (next.trim()) {
                        setCreateTaskDraft(boardId, status, next);
                        setDraftTitle(next.trim());
                    } else {
                        clearCreateTaskDraft(boardId, status);
                        setDraftTitle(null);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        skipBlurSubmit.current = true;
                        void submit();
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        skipBlurSubmit.current = true;
                        closeComposer();
                    }
                }}
                placeholder={t("tasks.addPlaceholder")}
                ref={inputReference}
                value={title}
            />
        </div>
    );
}
