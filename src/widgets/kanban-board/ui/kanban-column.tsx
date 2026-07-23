import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectLabel } from "@/features/labels";

import { useBoardColumns } from "@/features/boards";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    columnAccentClass,
    type Task,
    taskKeys,
    type TaskStatus,
} from "@/features/tasks";
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

type KanbanColumnProperties = {
    boardId: string;
    labelsByTaskId: Map<string, ProjectLabel[]>;
    name: string;
    projectId: string;
    startEditing?: boolean;
    status: TaskStatus;
    tasks: Task[];
};

export function KanbanColumn({
    boardId,
    labelsByTaskId,
    name,
    projectId,
    startEditing = false,
    status,
    tasks,
}: KanbanColumnProperties) {
    const { t } = useTranslation("board");
    const queryClient = useQueryClient();
    const { columns, deleteColumn, renameColumn } = useBoardColumns(
        projectId,
        boardId
    );
    const { canManageBoard } = useProjectAccess(projectId);
    const accentClass = columnAccentClass(status);

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

    const [isEditing, setIsEditing] = useState(startEditing);
    const [draft, setDraft] = useState(name);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const inputReference = useRef<HTMLInputElement>(null);

    const otherColumns = columns.filter((column) => column.id !== status);
    const canDelete = otherColumns.length > 0;
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

    const commitRename = async () => {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === name) {
            setDraft(name);
            setIsEditing(false);
            return;
        }

        const ok = await renameColumn(status, trimmed);
        if (!ok) {
            toast.error(t("columns.renameFailed"));
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

    const handleConfirmDelete = async () => {
        const movedTasks = tasks.length > 0;
        const ok = movedTasks
            ? await deleteColumn(status, moveTo)
            : await deleteColumn(status);

        if (!ok) {
            toast.error(t("columns.deleteFailed"));
            return;
        }

        if (movedTasks) {
            void queryClient.invalidateQueries({
                queryKey: [...taskKeys.all, "board", projectId],
            });
            void queryClient.invalidateQueries({
                queryKey: taskKeys.archived(projectId, boardId),
            });
        }

        toast.success(
            movedTasks
                ? t("columns.deletedWithMove", {
                      count: tasks.length,
                      name,
                      target:
                          otherColumns.find((column) => column.id === moveTo)
                              ?.name ?? "",
                  })
                : t("columns.deleted", { name })
        );
        setDeleteOpen(false);
    };

    return (
        <>
            <section
                className={cn(
                    "group/column flex h-full min-h-0 min-w-72 flex-1 shrink-0 flex-col gap-3 border-r border-border px-3 py-1 transition-colors last:border-r-0",
                    isOver && !isDragging && "bg-primary/5",
                    isDragging && "opacity-40"
                )}
                data-column-id={status}
                ref={setNodeRef}
                style={{
                    transform: CSS.Translate.toString(transform),
                    transition,
                }}
            >
                <header className="flex items-center gap-1.5 px-0.5">
                    {canManageBoard ? (
                        <button
                            aria-label={t("columns.dragAria")}
                            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
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
                            "size-2 shrink-0 rounded-xs",
                            accentClass
                        )}
                    />

                    {isEditing && canManageBoard ? (
                        <Input
                            aria-label={t("columns.renameAria")}
                            className="h-7 flex-1 border-transparent bg-transparent px-1 text-meta font-medium shadow-none focus-visible:border-ring focus-visible:bg-background"
                            onBlur={commitRename}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.currentTarget.blur();
                                }
                                if (event.key === "Escape") {
                                    setDraft(name);
                                    setIsEditing(false);
                                }
                            }}
                            ref={inputReference}
                            value={draft}
                        />
                    ) : canManageBoard ? (
                        <button
                            className="min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-meta font-medium outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
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
                    <span className="shrink-0 text-meta text-muted-foreground">
                        {tasks.length}
                    </span>
                    {canManageBoard ? (
                        <Button
                            aria-label={t("columns.deleteAria")}
                            className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-focus-within/column:opacity-100 group-hover/column:opacity-100 focus-visible:opacity-100"
                            onClick={handleDeleteClick}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
                    ) : undefined}
                </header>

                <div className="scrollbar-board flex flex-1 flex-col gap-2 overflow-y-auto">
                    <SortableContext
                        items={tasks.map((task) => task.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {tasks.map((task) => (
                            <DraggableTaskCard
                                key={task.id}
                                labels={labelsByTaskId.get(task.id) ?? []}
                                task={task}
                            />
                        ))}
                    </SortableContext>
                    <KanbanAddTask
                        boardId={boardId}
                        projectId={projectId}
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
