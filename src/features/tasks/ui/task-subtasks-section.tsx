import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Task } from "@/features/tasks/model/types";

import { PARENT_LINK_ERROR } from "@/features/tasks/lib/task-structure";
import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type TaskSubtasksSectionProperties = {
    boardId: string;
    canAdd: boolean;
    parent: Task;
    projectId: string;
};

export function TaskSubtasksSection({
    boardId,
    canAdd,
    parent,
    projectId,
}: TaskSubtasksSectionProperties) {
    const { t } = useTranslation("board");
    const { createSubtask } = useBoardTasks(projectId, boardId);
    const { data: projectTasks = [] } = useProjectTasks(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurClose = useRef(false);

    const children = projectTasks.filter(
        (task) => task.parentId === parent.id && !task.archivedAt
    );

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            setOpen(false);
            setTitle("");
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const created = await createSubtask(parent.id, trimmed);
            toast.success(t("subtasks.created", { key: created.key }));
            setOpen(false);
            setTitle("");
        } catch (error) {
            toast.error(subtaskCreateErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-ui font-medium">{t("subtasks.title")}</h3>
                {canAdd && !open ? (
                    <Button
                        className="h-8 gap-1.5 text-muted-foreground"
                        onClick={() => {
                            setOpen(true);
                            queueMicrotask(() => {
                                inputReference.current?.focus();
                            });
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <Plus className="size-4 shrink-0" />
                        {t("subtasks.add")}
                    </Button>
                ) : undefined}
            </div>

            {canAdd && open ? (
                <Input
                    aria-label={t("subtasks.addPlaceholder")}
                    className="h-8 bg-background font-mono text-code"
                    disabled={isSubmitting}
                    maxLength={TASK_TITLE_MAX_LENGTH}
                    onBlur={() => {
                        if (skipBlurClose.current) {
                            skipBlurClose.current = false;
                            return;
                        }
                        if (!title.trim()) {
                            setOpen(false);
                        }
                    }}
                    onChange={(event) => {
                        setTitle(event.target.value);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            skipBlurClose.current = true;
                            void submit();
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            skipBlurClose.current = true;
                            setOpen(false);
                            setTitle("");
                        }
                    }}
                    placeholder={t("subtasks.addPlaceholder")}
                    ref={inputReference}
                    value={title}
                />
            ) : undefined}

            {children.length === 0 ? (
                <p className="text-ui text-muted-foreground">
                    {t("subtasks.empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {children.map((child) => (
                        <li key={child.id}>
                            <button
                                className="flex min-w-0 w-full items-center gap-2 rounded-none border border-border px-2 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => {
                                    selectTask(child.id);
                                }}
                                type="button"
                            >
                                <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                    {child.key}
                                </span>
                                <span className="min-w-0 truncate text-ui">
                                    {child.title}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function subtaskCreateErrorMessage(
    error: unknown,
    t: (key: string) => string
): string {
    const message = error instanceof Error ? error.message : "";
    if (message === PARENT_LINK_ERROR.parent_is_subtask) {
        return t("subtasks.nestedRefused");
    }
    if (message === PARENT_LINK_ERROR.child_is_parent) {
        return t("subtasks.parentAsChildRefused");
    }
    if (message === PARENT_LINK_ERROR.different_project) {
        return t("subtasks.differentProject");
    }
    return t("subtasks.createFailed");
}
