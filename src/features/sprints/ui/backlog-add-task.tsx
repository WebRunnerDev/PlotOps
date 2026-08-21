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
    clearCreateBacklogTaskDraft,
    getCreateBacklogTaskDraft,
    setCreateBacklogTaskDraft,
} from "@/features/tasks/lib/task-drafts";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type BacklogAddTaskProperties = {
    boardId: string;
    projectId: string;
    /** Target sprint; omit / null = product backlog. */
    sprintId?: null | string;
    /** First board column — same default as board / command palette create. */
    status: TaskStatus;
};

export function BacklogAddTask({
    boardId,
    projectId,
    sprintId = null,
    status,
}: BacklogAddTaskProperties) {
    const { t } = useTranslation("board");
    const { createTask } = useBoardTasks(projectId, boardId);
    const { canCreateTasks, isSettled } = useProjectAccess(projectId);
    const canCreate = isSettled && canCreateTasks;
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftTitle, setDraftTitle] = useState<null | string>(() => {
        return getCreateBacklogTaskDraft(boardId, sprintId)?.title ?? null;
    });
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurSubmit = useRef(false);

    useEffect(() => {
        setDraftTitle(
            getCreateBacklogTaskDraft(boardId, sprintId)?.title ?? null
        );
    }, [boardId, sprintId]);

    useEffect(() => {
        if (!open) return;
        const draft = getCreateBacklogTaskDraft(boardId, sprintId);
        if (draft) {
            setTitle(draft.title);
            setDraftTitle(draft.title);
        }
        inputReference.current?.focus();
    }, [boardId, open, sprintId]);

    const closeComposer = () => {
        const trimmed = title.trim();
        if (trimmed) {
            setCreateBacklogTaskDraft(boardId, sprintId, trimmed);
            setDraftTitle(trimmed);
        } else {
            clearCreateBacklogTaskDraft(boardId, sprintId);
            setDraftTitle(null);
        }
        setOpen(false);
        setTitle("");
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            clearCreateBacklogTaskDraft(boardId, sprintId);
            setDraftTitle(null);
            setOpen(false);
            setTitle("");
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const task = await createTask(status, trimmed, {
                sprintId: sprintId ?? undefined,
            });
            clearCreateBacklogTaskDraft(boardId, sprintId);
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
            <div className="border-t border-border px-2 py-1.5">
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
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1 border-t border-border px-2 py-1.5">
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
                    closeComposer();
                }}
                onChange={(event) => {
                    const next = event.target.value;
                    setTitle(next);
                    if (next.trim()) {
                        setCreateBacklogTaskDraft(boardId, sprintId, next);
                        setDraftTitle(next.trim());
                    } else {
                        clearCreateBacklogTaskDraft(boardId, sprintId);
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
