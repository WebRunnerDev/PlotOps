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
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurSubmit = useRef(false);

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
        inputReference.current?.focus();
    }, [open]);

    const reset = () => {
        setOpen(false);
        setTitle("");
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            reset();
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const task = await createTask(status, trimmed, {
                sprintId: createSprintId,
            });
            selectTask(task.id);
            reset();
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
                className="h-8 w-full justify-start gap-2 text-muted-foreground"
                onClick={() => setOpen(true)}
                type="button"
                variant="ghost"
            >
                <Plus className="size-4" />
                {t("tasks.add")}
            </Button>
        );
    }

    return (
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
                void submit();
            }}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    skipBlurSubmit.current = true;
                    void submit();
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    skipBlurSubmit.current = true;
                    reset();
                }
            }}
            placeholder={t("tasks.addPlaceholder")}
            ref={inputReference}
            value={title}
        />
    );
}
