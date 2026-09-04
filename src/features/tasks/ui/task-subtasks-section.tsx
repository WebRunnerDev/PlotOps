import { useQueries } from "@tanstack/react-query";
import { Plus, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { BoardColumn } from "@/features/boards";
import type { Task } from "@/features/tasks/model/types";

import { useBoardColumns, useProjectBoards } from "@/features/boards";
import { isGuest } from "@/features/guest-mode";
import { useProjectLabels } from "@/features/labels";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import {
    collectParentTaskCandidates,
    collectSubtaskLinkCandidates,
} from "@/features/tasks/lib/collect-parent-task-candidates";
import { mergeTaskCatalogs } from "@/features/tasks/lib/collect-task-link-candidates";
import { PARENT_LINK_ERROR } from "@/features/tasks/lib/task-structure";
import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import { taskKeys } from "@/features/tasks/model/query-keys";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { TaskSearchPicker } from "@/features/tasks/ui/task-search-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

type AddMode = "create" | "link";

type TaskSubtasksSectionProperties = {
    boardId: string;
    canAdd: boolean;
    canRemoveParent: boolean;
    canSetParent: boolean;
    projectId: string;
    task: Task;
};

export function TaskSubtasksSection({
    boardId,
    canAdd,
    canRemoveParent,
    canSetParent,
    projectId,
    task,
}: TaskSubtasksSectionProperties) {
    const { t } = useTranslation("board");
    const { clearTaskParent, createSubtask, setTaskParent } = useBoardTasks(
        projectId,
        boardId
    );
    const { columns } = useBoardColumns(projectId, boardId);
    const { data: projectTasks = [] } = useProjectTasks(projectId, true, {
        includeArchived: true,
    });
    const { data: boards = [] } = useProjectBoards(projectId);
    const { labels } = useProjectLabels(projectId);
    const people = useProjectPeople(projectId);
    const tasksProvider = resolveTasksProvider(isGuest());
    const boardTaskQueries = useQueries({
        queries: boards.map((board) => ({
            enabled: Boolean(projectId && board.id),
            queryFn: () => tasksProvider.fetchBoardTasks(board.id),
            queryKey: taskKeys.board(projectId, board.id),
        })),
    });
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [addOpen, setAddOpen] = useState(false);
    const [addMode, setAddMode] = useState<AddMode>("create");
    const [setParentOpen, setSetParentOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const addFormReference = useRef<HTMLDivElement>(null);
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurClose = useRef(false);

    const isSubtask = task.parentId != undefined;
    const parentTask = isSubtask
        ? projectTasks.find((item) => item.id === task.parentId)
        : undefined;
    const children = isSubtask
        ? []
        : projectTasks.filter(
              (item) => item.parentId === task.id && !item.archivedAt
          );

    const catalog = useMemo(
        () =>
            mergeTaskCatalogs([
                projectTasks,
                ...boardTaskQueries.map((query) => query.data?.tasks ?? []),
            ]),
        [boardTaskQueries, projectTasks]
    );

    const subtaskCandidates = useMemo(
        () =>
            collectSubtaskLinkCandidates({
                parentId: task.id,
                projectId,
                tasks: catalog,
            }),
        [catalog, projectId, task.id]
    );

    const parentCandidates = useMemo(
        () =>
            collectParentTaskCandidates({
                childId: task.id,
                projectId,
                tasks: catalog,
            }),
        [catalog, projectId, task.id]
    );

    const formOpen = addOpen || setParentOpen;

    const cancelAdd = () => {
        setAddOpen(false);
        setTitle("");
    };

    const cancelSetParent = () => {
        setSetParentOpen(false);
    };

    const submit = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            cancelAdd();
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const created = await createSubtask(task.id, trimmed);
            toast.success(t("subtasks.created", { key: created.key }));
            cancelAdd();
        } catch (error) {
            toast.error(subtaskCreateErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    const linkSubtask = async (child: null | Task) => {
        if (!child || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await setTaskParent(child.id, task.id);
            toast.success(t("subtasks.linked", { key: child.key }));
            cancelAdd();
        } catch (error) {
            toast.error(subtaskLinkErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    const assignParent = async (parent: null | Task) => {
        if (!parent || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await setTaskParent(task.id, parent.id);
            toast.success(t("subtasks.parentSet", { key: parent.key }));
            cancelSetParent();
        } catch (error) {
            toast.error(setParentErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                    {setParentOpen
                        ? t("subtasks.setParentTitle")
                        : isSubtask
                          ? t("subtasks.parentTitle")
                          : addOpen && addMode === "link"
                            ? t("subtasks.linkTitle")
                            : t("subtasks.title")}
                </h3>
                <div className="flex shrink-0 items-center gap-1">
                    {canRemoveParent ? (
                        <Button
                            className="h-8 px-2 text-muted-foreground"
                            onClick={() => {
                                void (async () => {
                                    try {
                                        await clearTaskParent(task.id);
                                        toast.success(
                                            t("subtasks.removedParent", {
                                                key: task.key,
                                            })
                                        );
                                    } catch {
                                        toast.error(
                                            t("subtasks.removeParentFailed")
                                        );
                                    }
                                })();
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            {t("subtasks.removeParent")}
                        </Button>
                    ) : undefined}
                    {formOpen ? (
                        <Button
                            className="h-8 px-2 text-muted-foreground"
                            disabled={isSubmitting}
                            onClick={() => {
                                if (addOpen) cancelAdd();
                                if (setParentOpen) cancelSetParent();
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            {t("subtasks.cancel")}
                        </Button>
                    ) : (
                        <>
                            {canSetParent ? (
                                <Button
                                    className="h-8 px-2 text-muted-foreground"
                                    onClick={() => {
                                        setSetParentOpen(true);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t("subtasks.setParent")}
                                </Button>
                            ) : undefined}
                            {canAdd ? (
                                <Button
                                    className="h-8 gap-1.5 text-muted-foreground"
                                    onClick={() => {
                                        setAddOpen(true);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Plus className="size-4 shrink-0" />
                                    {t("subtasks.add")}
                                </Button>
                            ) : undefined}
                        </>
                    )}
                </div>
            </div>

            {canAdd && addOpen ? (
                <div className="flex flex-col gap-2" ref={addFormReference}>
                    <Select
                        onValueChange={(value) => {
                            if (value === "create" || value === "link") {
                                skipBlurClose.current = true;
                                setAddMode(value);
                                if (value === "create") {
                                    queueMicrotask(() => {
                                        inputReference.current?.focus();
                                    });
                                }
                            }
                        }}
                        value={addMode}
                    >
                        <SelectTrigger
                            aria-label={t("subtasks.addModeLabel")}
                            className="h-8 w-full font-mono text-code"
                            onPointerDown={() => {
                                skipBlurClose.current = true;
                            }}
                        >
                            <span>
                                {addMode === "create"
                                    ? t("subtasks.addMode.create")
                                    : t("subtasks.addMode.link")}
                            </span>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                            <SelectItem value="create">
                                {t("subtasks.addMode.create")}
                            </SelectItem>
                            <SelectItem value="link">
                                {t("subtasks.addMode.link")}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {addMode === "create" ? (
                        <Input
                            aria-label={t("subtasks.addPlaceholder")}
                            className="h-8 bg-background font-mono text-code"
                            disabled={isSubmitting}
                            maxLength={TASK_TITLE_MAX_LENGTH}
                            onBlur={(event) => {
                                if (skipBlurClose.current) {
                                    skipBlurClose.current = false;
                                    return;
                                }
                                if (
                                    isAddFormInteractionTarget(
                                        event.relatedTarget,
                                        addFormReference.current
                                    )
                                ) {
                                    return;
                                }
                                if (!title.trim()) {
                                    cancelAdd();
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
                                    cancelAdd();
                                }
                            }}
                            placeholder={t("subtasks.addPlaceholder")}
                            ref={inputReference}
                            value={title}
                        />
                    ) : (
                        <TaskSearchPicker
                            boards={boards}
                            currentBoardId={boardId}
                            disabled={isSubmitting}
                            emptyText={t("subtasks.linkNoResults")}
                            items={subtaskCandidates}
                            labels={labels}
                            onSelect={(target) => {
                                void linkSubtask(target);
                            }}
                            people={people}
                            placeholder={t("subtasks.linkPlaceholder")}
                            projectId={projectId}
                        />
                    )}
                </div>
            ) : undefined}

            {canSetParent && setParentOpen ? (
                <div className="flex flex-col gap-2">
                    <p className="text-ui text-muted-foreground">
                        {t("subtasks.setParentHint")}
                    </p>
                    <TaskSearchPicker
                        boards={boards}
                        currentBoardId={boardId}
                        disabled={isSubmitting}
                        emptyText={t("subtasks.setParentNoResults")}
                        items={parentCandidates}
                        labels={labels}
                        onSelect={(target) => {
                            void assignParent(target);
                        }}
                        people={people}
                        placeholder={t("subtasks.setParentPlaceholder")}
                        projectId={projectId}
                    />
                </div>
            ) : undefined}

            {isSubtask ? (
                task.parentId ? (
                    <ul className="flex flex-col gap-1">
                        <li>
                            <SubtaskRow
                                columns={columns}
                                label={t("subtasks.openParent", {
                                    key:
                                        parentTask?.key ?? task.parentKey ?? "",
                                })}
                                onSelect={() => {
                                    selectTask(task.parentId!);
                                }}
                                t={t}
                                task={
                                    parentTask ?? {
                                        assignee: undefined,
                                        boardId: task.boardId,
                                        createdAt: task.createdAt,
                                        id: task.parentId,
                                        key: task.parentKey ?? task.parentId,
                                        status: task.status,
                                        title: t("subtasks.parentMissing"),
                                        type: task.type,
                                    }
                                }
                            />
                        </li>
                    </ul>
                ) : undefined
            ) : children.length === 0 && !formOpen ? (
                <p className="text-ui text-muted-foreground">
                    {t("subtasks.empty")}
                </p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {children.map((child) => (
                        <li key={child.id}>
                            <SubtaskRow
                                columns={columns}
                                label={child.key}
                                onSelect={() => {
                                    selectTask(child.id);
                                }}
                                t={t}
                                task={child}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function initials(name: string): string {
    const parts = name
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}

function isAddFormInteractionTarget(
    relatedTarget: EventTarget | null,
    formRoot: HTMLElement | null
): boolean {
    if (!(relatedTarget instanceof Element)) {
        return false;
    }

    if (formRoot?.contains(relatedTarget)) {
        return true;
    }

    return Boolean(
        relatedTarget.closest("[data-slot=select-content]") ||
        relatedTarget.closest("[data-slot=select-trigger]") ||
        relatedTarget.closest("[data-slot=combobox-content]") ||
        relatedTarget.closest("[data-slot=dropdown-menu-content]")
    );
}

function setParentErrorMessage(
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
    if (message === "Task already has a Parent Task") {
        return t("subtasks.alreadyHasParent");
    }
    return t("subtasks.setParentFailed");
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

function subtaskLinkErrorMessage(
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
    if (message === "Task already has a Parent Task") {
        return t("subtasks.alreadyHasParent");
    }
    return t("subtasks.linkFailed");
}

function SubtaskRow({
    columns,
    label,
    onSelect,
    t,
    task,
}: {
    columns: BoardColumn[];
    label: string;
    onSelect: () => void;
    t: (key: string, options?: Record<string, string>) => string;
    task: Task;
}) {
    const statusName =
        columns.find((column) => column.id === task.status)?.name ??
        task.status;
    const assigneeName = task.assignee?.name;

    return (
        <button
            aria-label={label}
            className="flex min-w-0 w-full items-center gap-2 rounded-none border border-border px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
            onClick={onSelect}
            type="button"
        >
            <span className="shrink-0 font-mono text-meta text-muted-foreground">
                {task.key}
            </span>
            <span className="min-w-0 flex-1 truncate text-ui">
                {task.title}
            </span>
            <span
                className="max-w-28 shrink-0 truncate text-meta text-muted-foreground"
                title={t("fields.status")}
            >
                {statusName}
            </span>
            <span
                className="flex min-w-0 max-w-32 shrink-0 items-center gap-1.5"
                title={assigneeName ?? t("fields.memberNone")}
            >
                <Avatar size="sm">
                    {task.assignee?.avatarUrl ? (
                        <AvatarImage
                            alt={assigneeName ?? ""}
                            src={task.assignee.avatarUrl}
                        />
                    ) : undefined}
                    <AvatarFallback className="text-meta">
                        {assigneeName ? (
                            initials(assigneeName)
                        ) : (
                            <User className="size-3" />
                        )}
                    </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 truncate text-meta text-muted-foreground sm:inline">
                    {assigneeName ?? t("fields.memberNone")}
                </span>
            </span>
        </button>
    );
}
