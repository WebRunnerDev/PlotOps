import { Plus, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { Task } from "@/features/tasks/model/types";

import {
    TASK_LINK_ERROR,
    taskLinkRefusal,
} from "@/features/tasks/lib/task-structure";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";

type TaskLinksSectionProperties = {
    boardId: string;
    canEdit: boolean;
    projectId: string;
    task: Task;
};

export function TaskLinksSection({
    boardId,
    canEdit,
    projectId,
    task,
}: TaskLinksSectionProperties) {
    const { t } = useTranslation("board");
    const { createTaskLink, deleteTaskLink } = useBoardTasks(
        projectId,
        boardId
    );
    const { data: projectTasks = [] } = useProjectTasks(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const related = (task.relatedTasks ?? []).filter(
        (peer) => peer.kind === "relates_to"
    );

    const candidates = useMemo(() => {
        const linkedIds = new Set(related.map((peer) => peer.otherId));
        const nodes = projectTasks.map((item) => ({
            id: item.id,
            parentId: item.parentId,
            projectId,
        }));
        return projectTasks.filter((item) => {
            if (item.archivedAt || linkedIds.has(item.id)) return false;
            return (
                taskLinkRefusal(task.id, item.id, "relates_to", nodes, []) ===
                null
            );
        });
    }, [projectId, projectTasks, related, task.id]);

    const addLink = async (target: null | Task) => {
        if (!target || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await createTaskLink(task.id, target.id, "relates_to");
            toast.success(t("taskLinks.added", { key: target.key }));
            setOpen(false);
        } catch (error) {
            toast.error(taskLinkErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    const removeLink = async (linkId: string, otherKey: string) => {
        try {
            await deleteTaskLink(linkId);
            toast.success(t("taskLinks.removed", { key: otherKey }));
        } catch {
            toast.error(t("taskLinks.removeFailed"));
        }
    };

    const emptySelection: null | Task = null;

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-ui font-medium">{t("taskLinks.title")}</h3>
                {canEdit && !open ? (
                    <Button
                        className="h-8 gap-1.5 text-muted-foreground"
                        onClick={() => {
                            setOpen(true);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <Plus className="size-4 shrink-0" />
                        {t("taskLinks.add")}
                    </Button>
                ) : undefined}
            </div>

            {canEdit && open ? (
                <Combobox
                    disabled={isSubmitting}
                    isItemEqualToValue={(
                        left: null | Task,
                        right: null | Task
                    ) => left?.id === right?.id}
                    items={candidates}
                    itemToStringLabel={(item: null | Task) =>
                        item ? `${item.key} ${item.title}` : ""
                    }
                    onValueChange={(value: null | Task) => {
                        void addLink(value);
                    }}
                    value={emptySelection}
                >
                    <ComboboxInput
                        aria-label={t("taskLinks.addPlaceholder")}
                        className="h-8 w-full font-mono text-code"
                        placeholder={t("taskLinks.addPlaceholder")}
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>
                            {t("taskLinks.noResults")}
                        </ComboboxEmpty>
                        <ComboboxList>
                            {(item: Task) => (
                                <ComboboxItem key={item.id} value={item}>
                                    <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                        {item.key}
                                    </span>
                                    <span className="min-w-0 truncate">
                                        {item.title}
                                    </span>
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            ) : undefined}

            <div className="flex flex-col gap-2">
                <h4 className="text-meta font-medium text-muted-foreground">
                    {t("taskLinks.relatesTo")}
                </h4>
                {related.length === 0 ? (
                    <p className="text-ui text-muted-foreground">
                        {t("taskLinks.empty")}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {related.map((peer) => (
                            <li
                                className="flex min-w-0 items-center gap-1"
                                key={peer.id}
                            >
                                <button
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-none border border-border px-2 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => {
                                        selectTask(peer.otherId);
                                    }}
                                    type="button"
                                >
                                    <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                        {peer.otherKey}
                                    </span>
                                    <span className="min-w-0 truncate text-ui">
                                        {peer.otherTitle}
                                    </span>
                                </button>
                                {canEdit ? (
                                    <Button
                                        aria-label={t("taskLinks.remove", {
                                            key: peer.otherKey,
                                        })}
                                        className="size-8 shrink-0"
                                        onClick={() => {
                                            void removeLink(
                                                peer.id,
                                                peer.otherKey
                                            );
                                        }}
                                        size="icon"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <XIcon className="size-4" />
                                    </Button>
                                ) : undefined}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

function taskLinkErrorMessage(
    error: unknown,
    t: (key: string) => string
): string {
    const message = error instanceof Error ? error.message : "";
    if (message === TASK_LINK_ERROR.self) {
        return t("taskLinks.selfRefused");
    }
    if (message === TASK_LINK_ERROR.parent_subtask) {
        return t("taskLinks.parentSubtaskRefused");
    }
    if (message === TASK_LINK_ERROR.different_project) {
        return t("taskLinks.differentProject");
    }
    if (message === TASK_LINK_ERROR.duplicate) {
        return t("taskLinks.duplicate");
    }
    return t("taskLinks.addFailed");
}
