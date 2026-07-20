import { Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    BoardColumn,
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import { fetchBoardColumns } from "@/features/tasks/api/boards-api";
import { TASK_PRIORITIES, TASK_TYPES } from "@/features/tasks/model/constants";
import { isSharedBranch } from "@/features/tasks/lib/format-branch";
import { TaskGitTab } from "@/features/git-integration/ui/task-git-tab";
import { useBoardContext } from "@/features/tasks/model/board-context";
import { useProjectBoards } from "@/features/tasks/model/use-project-boards";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { TaskGithubPanel } from "@/features/tasks/ui/task-github-panel";
import { TaskLabelsField } from "@/features/tasks/ui/task-labels-field";
import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
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
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@/shared/shadcn/ui/drawer";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";
import { Separator } from "@/shared";

const TASK_DRAWER_SNAP_POINTS = ["32rem", 0.92] as const;
const PRIORITY_NONE = "__none__";

type MoveBoardTarget = {
    boardId: string;
    boardName: string;
    columnId: TaskStatus;
    columns: BoardColumn[];
};

type TaskDrawerProperties = {
    githubToken: null | string;
    projectId: string;
    repoFullName: string | undefined;
};

export function TaskDrawer({
    githubToken,
    projectId,
    repoFullName,
}: TaskDrawerProperties) {
    const { t } = useTranslation("board");
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const {
        boardId,
        columns,
        deleteTask,
        labels,
        moveTaskToOtherBoard,
        tasks,
        updateTaskDetails,
        updateTaskStatus,
    } = useBoardContext();
    const { data: boards = [] } = useProjectBoards(projectId);
    const currentBoard = boards.find((board) => board.id === boardId);
    const navigate = useNavigate();
    const { canDeleteTasks, canEditTasks } = useProjectAccess(projectId);
    const clearSelectedTask = useTasksUiStore((state) => state.clearSelectedTask);

    const task = tasks.find((item) => item.id === selectedTaskId);

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId],
    );

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        key: string;
        title: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [moveTarget, setMoveTarget] = useState<MoveBoardTarget | null>(null);
    const [isMoving, setIsMoving] = useState(false);
    const [isLoadingMoveColumns, setIsLoadingMoveColumns] = useState(false);

    const selectedColumn = columns.find((column) => column.id === task?.status);
    const moveToColumnName =
        moveTarget?.columns.find((column) => column.id === moveTarget.columnId)
            ?.name ?? "";

    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setDescription(task.description ?? "");
    }, [task]);

    const commitTitle = () => {
        if (!task) return;
        const next = title.trim();
        if (!next || next === task.title) {
            setTitle(task.title);
            return;
        }
        updateTaskDetails(task.id, { title: next });
    };

    const commitDescription = () => {
        if (!task) return;
        const next = description;
        const current = task.description ?? "";
        if (next === current) return;
        updateTaskDetails(task.id, {
            description: next.length > 0 ? next : undefined,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || isDeleting) return;

        const { id, key } = deleteTarget;
        setIsDeleting(true);
        try {
            await deleteTask(id);
            setDeleteTarget(null);
            clearSelectedTask();
            toast.success(t("tasks.deleted", { key }));
        } catch {
            toast.error(t("tasks.deleteFailed"));
        } finally {
            setIsDeleting(false);
        }
    };

    const openMoveToBoard = async (targetBoardId: string) => {
        if (!task || targetBoardId === boardId || isLoadingMoveColumns) return;

        setIsLoadingMoveColumns(true);
        try {
            const targetColumns = await fetchBoardColumns(targetBoardId);
            if (targetColumns.length === 0) {
                toast.error(t("boards.taskMoveFailed"));
                return;
            }

            const sameName = selectedColumn
                ? targetColumns.find(
                      (column) =>
                          column.name.trim().toLowerCase() ===
                          selectedColumn.name.trim().toLowerCase(),
                  )
                : undefined;

            setMoveTarget({
                boardId: targetBoardId,
                boardName:
                    boards.find((board) => board.id === targetBoardId)?.name ??
                    "",
                columnId: (sameName?.id ?? targetColumns[0]!.id) as TaskStatus,
                columns: targetColumns.map((column) => ({
                    id: column.id as TaskStatus,
                    name: column.name,
                })),
            });
        } catch {
            toast.error(t("boards.taskMoveFailed"));
        } finally {
            setIsLoadingMoveColumns(false);
        }
    };

    const handleConfirmMove = async () => {
        if (!task || !moveTarget || isMoving) return;

        setIsMoving(true);
        try {
            await moveTaskToOtherBoard(
                task.id,
                moveTarget.boardId,
                moveTarget.columnId,
            );
            setMoveTarget(null);
            clearSelectedTask();
            toast.success(t("boards.taskMoved"));
            void navigate({
                params: {
                    boardId: moveTarget.boardId,
                    projectId,
                },
                to: "/projects/$projectId/boards/$boardId",
            });
        } catch {
            toast.error(t("boards.taskMoveFailed"));
        } finally {
            setIsMoving(false);
        }
    };

    return (
        <>
        <Drawer
            onOpenChange={(open) => {
                if (!open) {
                    commitDescription();
                    clearSelectedTask();
                }
            }}
            open={Boolean(task)}
            showSwipeHandle
            snapPoints={[...TASK_DRAWER_SNAP_POINTS]}
            swipeDirection="down"
        >
            <DrawerContent>
                {task ? (
                    <>
                        <DrawerHeader className="text-left p-2">
                            <p className="text-meta font-mono text-muted-foreground">
                                {task.key}
                            </p>
                            <DrawerTitle className="sr-only">
                                {task.title}
                            </DrawerTitle>
                            <DrawerDescription>
                                {t("drawerDescription")}
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="mx-auto flex min-h-0 w-full min-w-7xl max-w-7xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:flex-row">
                            {/* Title and Description */}
                            <div className="flex min-w-0 flex-[2_1_0%] flex-col gap-6">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="task-title">
                                        {t("fields.title")}
                                    </Label>
                                    <Input
                                        className="text-h3 font-medium"
                                        disabled={!canEditTasks}
                                        id="task-title"
                                        onBlur={commitTitle}
                                        onChange={(event) =>
                                            setTitle(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.currentTarget.blur();
                                            }
                                        }}
                                        value={title}
                                    />
                                </div>

                                <div className="flex min-w-0 flex-col gap-2">
                                    <Label
                                        htmlFor="task-description"
                                        id="task-description-label"
                                    >
                                        {t("fields.description")}
                                    </Label>
                                    <RichTextEditor
                                        id="task-description"
                                        onBlur={commitDescription}
                                        onChange={setDescription}
                                        onUploadImage={(file) =>
                                            uploadTaskMedia(file, task.id)
                                        }
                                        placeholder={t(
                                            "fields.descriptionPlaceholder",
                                        )}
                                        value={description}
                                    />
                                </div>
                            </div>
                            <Separator
                                className="hidden shrink-0 md:block"
                                orientation="vertical"
                            />
                            {/* Type, Status, Priority, Deadline */}
                            <div className="flex min-w-0 flex-[1_1_0%] flex-col gap-6">
                                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-type">
                                            {t("fields.type")}
                                        </Label>
                                        <Select
                                            onValueChange={(value) => {
                                                updateTaskDetails(task.id, {
                                                    type: value as TaskType,
                                                });
                                            }}
                                            value={task.type}
                                        >
                                            <SelectTrigger
                                                className="w-full"
                                                id="task-type"
                                            >
                                                <span>
                                                    {t(`taskType.${task.type}`)}
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent alignItemWithTrigger={false}>
                                                {TASK_TYPES.map((type) => (
                                                    <SelectItem
                                                        key={type}
                                                        value={type}
                                                    >
                                                        {t(`taskType.${type}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-status">
                                            {t("fields.status")}
                                        </Label>
                                        <Combobox
                                            isItemEqualToValue={(a, b) =>
                                                a.id === b.id
                                            }
                                            items={columns}
                                            itemToStringLabel={(item) =>
                                                item.name
                                            }
                                            onValueChange={(value) => {
                                                if (value) {
                                                    updateTaskStatus(
                                                        task.id,
                                                        value.id,
                                                    );
                                                }
                                            }}
                                            value={selectedColumn ?? null}
                                        >
                                            <ComboboxInput
                                                className="w-full"
                                                id="task-status"
                                            />
                                            <ComboboxContent>
                                                <ComboboxEmpty>
                                                    {t("columns.noResults")}
                                                </ComboboxEmpty>
                                                <ComboboxList>
                                                    {(column: BoardColumn) => (
                                                        <ComboboxItem
                                                            key={column.id}
                                                            value={column}
                                                        >
                                                            {column.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                    </div>

                                    {boards.length > 1 ? (
                                        <div className="flex flex-col gap-2">
                                            <Label htmlFor="task-board">
                                                {t("fields.board")}
                                            </Label>
                                            <Select
                                                onValueChange={(value) => {
                                                    if (
                                                        typeof value !==
                                                            "string" ||
                                                        value === boardId
                                                    ) {
                                                        return;
                                                    }
                                                    void openMoveToBoard(value);
                                                }}
                                                value={boardId}
                                                disabled={
                                                    !canEditTasks ||
                                                    isLoadingMoveColumns ||
                                                    isMoving
                                                }
                                            >
                                                <SelectTrigger
                                                    className="w-full"
                                                    id="task-board"
                                                >
                                                    <span>
                                                        {currentBoard?.name ??
                                                            t("boards.loading")}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {boards.map((board) => (
                                                        <SelectItem
                                                            key={board.id}
                                                            value={board.id}
                                                        >
                                                            {board.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : undefined}

                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-priority">
                                            {t("fields.priority")}
                                        </Label>
                                        <Select
                                            onValueChange={(value) => {
                                                if (typeof value !== "string") {
                                                    return;
                                                }
                                                updateTaskDetails(task.id, {
                                                    priority:
                                                        value === PRIORITY_NONE
                                                            ? undefined
                                                            : (value as TaskPriority),
                                                });
                                            }}
                                            value={task.priority ?? PRIORITY_NONE}
                                        >
                                            <SelectTrigger
                                                className="w-full"
                                                id="task-priority"
                                            >
                                                <span>
                                                    {task.priority
                                                        ? t(`priority.${task.priority}`)
                                                        : t("priority.none")}
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent alignItemWithTrigger={false}>
                                                <SelectItem value={PRIORITY_NONE}>
                                                    {t("priority.none")}
                                                </SelectItem>
                                                {TASK_PRIORITIES.map((priority) => (
                                                    <SelectItem
                                                        key={priority}
                                                        value={priority}
                                                    >
                                                        {t(`priority.${priority}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="task-deadline">
                                            {t("fields.deadline")}
                                        </Label>
                                        <Input
                                            id="task-deadline"
                                            onChange={(event) => {
                                                const next = event.target.value;
                                                updateTaskDetails(task.id, {
                                                    deadline:
                                                        next.length > 0
                                                            ? next
                                                            : undefined,
                                                });
                                            }}
                                            type="date"
                                            value={task.deadline ?? ""}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label>{t("fields.labels")}</Label>
                                    <TaskLabelsField
                                        labels={projectLabels}
                                        projectId={projectId}
                                        selectedIds={task.labelIds ?? []}
                                        taskId={task.id}
                                    />
                                </div>

                                <TaskGithubPanel
                                    allowedHeadPatterns={
                                        currentBoard?.allowedHeadPatterns ?? []
                                    }
                                    baseBranch={
                                        currentBoard?.baseBranch ?? "main"
                                    }
                                    githubToken={githubToken}
                                    onBranchChange={(branchName) => {
                                        updateTaskDetails(task.id, {
                                            branchName,
                                        });
                                    }}
                                    onPrChange={(pr) => {
                                        updateTaskDetails(task.id, { pr });
                                    }}
                                    repoFullName={repoFullName}
                                    task={task}
                                />

                                {/* Live Git data — only when branch is set and token available */}
                                {task.branchName &&
                                    githubToken &&
                                    repoFullName && (
                                        <TaskGitTab
                                            branchName={task.branchName}
                                            isShared={isSharedBranch(
                                                task.branchName,
                                            )}
                                            repoFullName={repoFullName}
                                            token={githubToken}
                                        />
                                    )}

                                <div className="mt-auto border-t border-foreground/10 pt-4">
                                    {canDeleteTasks ? (
                                        <Button
                                            className="w-full"
                                            disabled={isDeleting}
                                            onClick={() =>
                                                setDeleteTarget({
                                                    id: task.id,
                                                    key: task.key,
                                                    title: task.title,
                                                })
                                            }
                                            type="button"
                                            variant="destructive"
                                        >
                                            <Trash2 data-icon="inline-start" />
                                            {t("tasks.delete")}
                                        </Button>
                                    ) : undefined}
                                </div>
                            </div>
                        </div>
                    </>
                ) : undefined}
            </DrawerContent>
        </Drawer>

        <AlertDialog
            onOpenChange={(open) => {
                if (!open && !isDeleting) setDeleteTarget(null);
            }}
            open={deleteTarget !== null}
        >
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("tasks.deleteTitle", {
                            key: deleteTarget?.key ?? "",
                        })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("tasks.deleteDescription", {
                            title: deleteTarget?.title ?? "",
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                        {t("tasks.deleteCancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isDeleting}
                        onClick={() => {
                            void handleConfirmDelete();
                        }}
                        variant="destructive"
                    >
                        {t("tasks.deleteConfirm")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
            onOpenChange={(open) => {
                if (!open && !isMoving) setMoveTarget(null);
            }}
            open={moveTarget !== null}
        >
            <AlertDialogContent className="sm:max-w-sm" size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("boards.moveTitle", {
                            board: moveTarget?.boardName ?? "",
                        })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("boards.moveDescription")}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {moveTarget ? (
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="move-task-column">
                            {t("boards.moveToColumn")}
                        </Label>
                        <Select
                            onValueChange={(value) => {
                                if (typeof value !== "string") return;
                                setMoveTarget((current) =>
                                    current
                                        ? {
                                              ...current,
                                              columnId: value as TaskStatus,
                                          }
                                        : current,
                                );
                            }}
                            value={moveTarget.columnId}
                        >
                            <SelectTrigger
                                className="w-full"
                                id="move-task-column"
                            >
                                <span>{moveToColumnName}</span>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {moveTarget.columns.map((column) => (
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
                    <AlertDialogCancel disabled={isMoving}>
                        {t("boards.cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isMoving || !moveTarget?.columnId}
                        onClick={() => {
                            void handleConfirmMove();
                        }}
                    >
                        {t("boards.moveConfirm")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
