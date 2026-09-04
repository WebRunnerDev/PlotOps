import { useDroppable } from "@dnd-kit/core";
import {
    SortableContext,
    type SortingStrategy,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, GripVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectLabel } from "@/features/labels";

import { useBoardColumns } from "@/features/boards";
import { resolveColumnDeleteMoveTarget } from "@/features/boards/model/resolve-column-delete-move-target";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    columnAccentClass,
    type SubtaskProgress,
    type Task,
    taskKeys,
    type TaskStatus,
} from "@/features/tasks";
import { columnTaskDropId } from "@/features/tasks/lib/board-drop-target-id";
import { cn } from "@/shared/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

import { DraggableTaskCard } from "./draggable-task-card";
import { KanbanAddTask } from "./kanban-add-task";

/** Keeps cards draggable across columns without within-column gap preview. */
const staticTaskSortingStrategy: SortingStrategy = () => null;

type KanbanColumnProperties = {
    boardId: string;
    createSprintId?: string;
    labelsByTaskId: Map<string, ProjectLabel[]>;
    name: string;
    projectId: string;
    startAddingTask?: boolean;
    startEditing?: boolean;
    status: TaskStatus;
    subtaskProgressByTaskId?: Map<string, SubtaskProgress>;
    tasks: Task[];
    withinColumnDragEnabled?: boolean;
};

export function KanbanColumn({
    boardId,
    createSprintId,
    labelsByTaskId,
    name,
    projectId,
    startAddingTask = false,
    startEditing = false,
    status,
    subtaskProgressByTaskId,
    tasks,
    withinColumnDragEnabled = true,
}: KanbanColumnProperties) {
    const { t } = useTranslation("board");
    const queryClient = useQueryClient();
    const { columns, deleteColumn, renameColumn, setDoneColumn } =
        useBoardColumns(projectId, boardId);
    const { canDeleteTasks, canEditTasks, canManageBoard, isSettled } =
        useProjectAccess(projectId);
    const canEdit = isSettled && canEditTasks;
    const canManage = isSettled && canManageBoard;
    const canSelectForArchive = isSettled && canDeleteTasks;

    const {
        attributes,
        isDragging,
        isOver,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        data: { type: "column" },
        id: status,
    });

    const { isOver: isTaskListOver, setNodeRef: setTaskListDropReference } =
        useDroppable({
            data: { status, type: "column-tasks" },
            id: columnTaskDropId(status),
        });

    const [isEditing, setIsEditing] = useState(startEditing);
    const [draft, setDraft] = useState(name);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurCommit = useRef(false);

    const otherColumns = columns.filter((column) => column.id !== status);
    const canDelete = otherColumns.length > 0;
    const isDone =
        columns.find((column) => column.id === status)?.isDone ?? false;
    const [moveTo, setMoveTo] = useState<TaskStatus | undefined>(
        otherColumns[0]?.id
    );
    const moveToColumnName = otherColumns.find(
        (column) => column.id === moveTo
    )?.name;

    useEffect(() => {
        if (startEditing) setIsEditing(true);
    }, [startEditing]);

    useEffect(() => {
        if (!isEditing) setDraft(name);
    }, [isEditing, name]);

    useEffect(() => {
        if (!isEditing) return;
        const node = inputReference.current;
        if (!node) return;
        node.focus();
        node.select();
    }, [isEditing]);

    useEffect(() => {
        if (!deleteOpen) return;
        setMoveTo(columns.find((column) => column.id !== status)?.id);
    }, [columns, deleteOpen, status]);

    const columnTaskIds = tasks.map((columnTask) => columnTask.id);

    const commitRename = async () => {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === name) {
            setDraft(name);
            setIsEditing(false);
            return;
        }

        try {
            const ok = await renameColumn(status, trimmed);
            if (!ok) {
                toast.error(t("columns.renameFailed"));
                setDraft(name);
            }
        } catch {
            setDraft(name);
        }
        setIsEditing(false);
    };

    const handleDeleteClick = () => {
        if (!canDelete) {
            toast.error(t("columns.deleteLastFailed"));
            return;
        }
        setDeleteOpen(true);
    };

    const handleToggleDone = async () => {
        try {
            await setDoneColumn(status);
            toast.success(
                isDone
                    ? t("columns.doneCleared")
                    : t("columns.doneMarked", { name })
            );
        } catch {
            // Toast comes from useBoardColumns onError.
        }
    };

    const handleConfirmDelete = async () => {
        const moveTasksTo = resolveColumnDeleteMoveTarget({
            otherColumnId: moveTo,
            visibleTaskCount: tasks.length,
        });
        const movedVisibleTasks = tasks.length > 0;

        let ok = false;
        try {
            ok = await deleteColumn(status, moveTasksTo);
        } catch {
            return;
        }

        if (!ok) {
            toast.error(t("columns.deleteFailed"));
            return;
        }

        setDeleteOpen(false);

        // Remap covers active tasks moved off the deleted column.
        if (moveTasksTo) {
            void queryClient.invalidateQueries({
                queryKey: [...taskKeys.all, "board", projectId],
            });
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        }

        toast.success(
            movedVisibleTasks
                ? t("columns.deletedWithMove", {
                      count: tasks.length,
                      name,
                      target:
                          otherColumns.find(
                              (column) => column.id === moveTasksTo
                          )?.name ?? "",
                  })
                : t("columns.deleted", { name })
        );
    };

    return (
        <>
            <section
                className={cn(
                    "group/column flex h-full min-h-0 min-w-72 flex-1 shrink-0 flex-col border border-border bg-card/50 transition-colors duration-150 ease-[var(--ease-out-quart)]",
                    isOver && !isDragging && "border-primary/40 bg-primary/5",
                    isTaskListOver &&
                        !isDragging &&
                        "border-primary/40 bg-primary/5",
                    isDragging && "opacity-40"
                )}
                data-column-id={status}
                ref={setNodeRef}
                style={{
                    transform: CSS.Translate.toString(transform),
                    transition,
                }}
            >
                <header className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
                    {canManage ? (
                        <button
                            aria-label={t("columns.dragAria")}
                            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-none text-muted-foreground outline-none transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                            type="button"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical aria-hidden className="size-3.5" />
                        </button>
                    ) : undefined}

                    <span
                        aria-hidden
                        className={cn(
                            "size-2 shrink-0",
                            columnAccentClass(status)
                        )}
                    />

                    {isEditing && canManage ? (
                        <Input
                            aria-label={t("columns.renameAria")}
                            className="h-7 flex-1 rounded-none border-transparent bg-transparent px-1 text-meta font-medium shadow-none focus-visible:border-ring focus-visible:bg-background"
                            onBlur={() => {
                                if (skipBlurCommit.current) {
                                    skipBlurCommit.current = false;
                                    return;
                                }
                                void commitRename();
                            }}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    skipBlurCommit.current = true;
                                    void commitRename();
                                }
                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    skipBlurCommit.current = true;
                                    setDraft(name);
                                    setIsEditing(false);
                                }
                            }}
                            ref={inputReference}
                            value={draft}
                        />
                    ) : canManage ? (
                        <button
                            className="min-w-0 flex-1 truncate rounded-none px-1 py-0.5 text-left text-meta font-medium outline-none transition-colors duration-150 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setIsEditing(true)}
                            type="button"
                        >
                            {name}
                        </button>
                    ) : (
                        <span className="min-w-0 flex-1 truncate px-1 py-0.5 text-left text-meta font-medium">
                            {name}
                        </span>
                    )}
                    <span className="ml-auto shrink-0 text-meta text-muted-foreground/70 tabular-nums">
                        {tasks.length}
                    </span>
                    {canManage ? (
                        <Button
                            aria-label={
                                isDone
                                    ? t("columns.clearDoneAria")
                                    : t("columns.markDoneAria")
                            }
                            aria-pressed={isDone}
                            className={cn(
                                "size-7 shrink-0 rounded-none opacity-0 transition-opacity group-focus-within/column:opacity-100 group-hover/column:opacity-100 focus-visible:opacity-100",
                                isDone
                                    ? "text-success opacity-100"
                                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                            onClick={() => void handleToggleDone()}
                            size="icon-sm"
                            title={
                                isDone
                                    ? t("columns.clearDoneAria")
                                    : t("columns.markDoneAria")
                            }
                            type="button"
                            variant="ghost"
                        >
                            <CheckCircle2 className="size-3.5" />
                        </Button>
                    ) : undefined}
                    {canManage ? (
                        <Button
                            aria-label={t("columns.deleteAria")}
                            className="size-7 shrink-0 rounded-none text-muted-foreground opacity-0 transition-opacity group-focus-within/column:opacity-100 group-hover/column:opacity-100 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100"
                            onClick={handleDeleteClick}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    ) : undefined}
                </header>

                <div
                    className="scrollbar-board flex min-h-0 flex-1 flex-col overflow-y-auto"
                    ref={setTaskListDropReference}
                >
                    <div className="flex flex-col gap-px p-px">
                        <SortableContext
                            items={tasks.map((task) => task.id)}
                            strategy={
                                withinColumnDragEnabled
                                    ? verticalListSortingStrategy
                                    : staticTaskSortingStrategy
                            }
                        >
                            {tasks.map((task) => (
                                <DraggableTaskCard
                                    boardId={boardId}
                                    canDrag={canEdit}
                                    columnTaskIds={columnTaskIds}
                                    key={task.id}
                                    labels={labelsByTaskId.get(task.id) ?? []}
                                    selectionEnabled={canSelectForArchive}
                                    subtaskProgress={subtaskProgressByTaskId?.get(
                                        task.id
                                    )}
                                    task={task}
                                />
                            ))}
                        </SortableContext>
                    </div>
                    {tasks.length === 0 ? (
                        <div
                            aria-hidden
                            className="flex min-h-16 flex-1 shrink-0 items-center justify-center px-3"
                        >
                            <span className="text-meta text-muted-foreground/50">
                                {t("columns.empty")}
                            </span>
                        </div>
                    ) : undefined}
                </div>
                <div className="border-t border-border px-1 py-1">
                    <KanbanAddTask
                        boardId={boardId}
                        createSprintId={createSprintId}
                        projectId={projectId}
                        startOpen={startAddingTask}
                        status={status}
                    />
                </div>
            </section>

            <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
                <AlertDialogContent
                    className={tasks.length > 0 ? "sm:max-w-sm" : undefined}
                    size="sm"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("columns.deleteTitle", { name })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {tasks.length > 0
                                ? t("columns.deleteWithTasksDescription", {
                                      count: tasks.length,
                                  })
                                : t("columns.deleteEmptyDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {tasks.length > 0 ? (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`move-tasks-${status}`}>
                                {t("columns.moveTasksTo")}
                            </Label>
                            <Select
                                onValueChange={(value) => {
                                    if (typeof value === "string") {
                                        setMoveTo(value);
                                    }
                                }}
                                value={moveTo}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    id={`move-tasks-${status}`}
                                >
                                    <span>{moveToColumnName}</span>
                                </SelectTrigger>
                                <SelectContent alignItemWithTrigger={false}>
                                    {otherColumns.map((column) => (
                                        <SelectItem
                                            key={column.id}
                                            value={column.id}
                                        >
                                            {column.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : undefined}

                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("columns.deleteCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={tasks.length > 0 && !moveTo}
                            onClick={handleConfirmDelete}
                            variant="destructive"
                        >
                            {t("columns.deleteConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
