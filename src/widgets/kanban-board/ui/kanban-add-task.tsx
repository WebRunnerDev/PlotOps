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

type KanbanAddTaskProperties = {
    boardId: string;
    projectId: string;
    status: TaskStatus;
};

export function KanbanAddTask({
    boardId,
    projectId,
    status,
}: KanbanAddTaskProperties) {
    const { t } = useTranslation("board");
    const { createTask } = useBoardTasks(projectId, boardId);
    const { canCreateTasks } = useProjectAccess(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputReference = useRef<HTMLInputElement>(null);

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
            const task = await createTask(status, trimmed);
            selectTask(task.id);
            reset();
        } catch {
            toast.error(t("tasks.createFailed"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canCreateTasks) {
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
                void submit();
            }}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    reset();
                }
            }}
            placeholder={t("tasks.addPlaceholder")}
            ref={inputReference}
            value={title}
        />
    );
}
