import { useNavigate } from "@tanstack/react-router";
import { Archive, CalendarIcon, RotateCcw, Trash2, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { enUS, ru } from "react-day-picker/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";

import {
    type BoardColumn,
    fetchBoardColumns,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { TaskGitTab } from "@/features/git-integration/ui/task-git-tab";
import { TaskLabelsField, useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import { isSharedBranch } from "@/features/tasks/lib/format-branch";
import {
    formatDeadlineLong,
    parseIsoDate,
    toIsoDate,
} from "@/features/tasks/lib/format-deadline";
import {
    TASK_DESCRIPTION_MAX_LENGTH,
    TASK_PRIORITIES,
    TASK_TITLE_MAX_LENGTH,
    TASK_TYPES,
} from "@/features/tasks/model/constants";
import { useArchivedTasks } from "@/features/tasks/model/use-archived-tasks";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { GithubTaskMeta } from "@/features/tasks/ui/github-task-meta";
import { TaskActivitySection } from "@/features/tasks/ui/task-activity-section";
import { TaskCommentsSection } from "@/features/tasks/ui/task-comments-section";
import { TaskGithubPanel } from "@/features/tasks/ui/task-github-panel";
import { TaskMemberField } from "@/features/tasks/ui/task-member-field";
import { Separator } from "@/shared";
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
import { Calendar } from "@/shared/shadcn/ui/calendar";
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/shadcn/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";
import { isRichTextWithinLimit } from "@/shared/ui/rich-text-editor/content";

const TASK_DRAWER_SNAP_POINTS = ["32rem", 0.92] as const;
const PRIORITY_NONE = "__none__";
const FIELD_LABEL_CLASS = "text-meta text-muted-foreground";
const FIELD_CONTROL_CLASS = "w-full font-mono text-code";

type MoveBoardTarget = {
    boardId: string;
    boardName: string;
    columnId: TaskStatus;
    columns: BoardColumn[];
};

type TaskDrawerProperties = {
    boardId: string;
    githubToken: null | string;
    projectId: string;
    repoFullName: string | undefined;
};

export function TaskDrawer({
    boardId,
    githubToken,
    projectId,
    repoFullName,
}: TaskDrawerProperties) {
    const { t } = useTranslation("board");
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const { columns } = useBoardColumns(projectId, boardId);
    const { labels } = useProjectLabels(projectId);
    const {
        archiveTask,
        deleteTask,
        moveTaskToOtherBoard,
        restoreTask,
        tasks,
        updateTaskDetails,
        updateTaskStatus,
    } = useBoardTasks(projectId, boardId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const currentBoard = boards.find((board) => board.id === boardId);
    const navigate = useNavigate();
    const { canDeleteTasks, canEditTasks } = useProjectAccess(projectId);
    const clearSelectedTask = useTasksUiStore(
        (state) => state.clearSelectedTask
    );

    const boardTask = tasks.find((item) => item.id === selectedTaskId);
    const { data: archivedTasks = [] } = useArchivedTasks(
        projectId,
        boardId,
        Boolean(selectedTaskId) && !boardTask
    );
    const task =
        boardTask ?? archivedTasks.find((item) => item.id === selectedTaskId);
    const isArchived = Boolean(task?.archivedAt);
    const canEdit = canEditTasks && !isArchived;

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<null | {
        id: string;
        key: string;
        title: string;
    }>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [moveTarget, setMoveTarget] = useState<MoveBoardTarget | null>(null);
    const [isMoving, setIsMoving] = useState(false);
    const [isLoadingMoveColumns, setIsLoadingMoveColumns] = useState(false);
    const [activityOpen, setActivityOpen] = useState(false);

    const selectedColumn = columns.find((column) => column.id === task?.status);
    const moveToColumnName =
        moveTarget?.columns.find((column) => column.id === moveTarget.columnId)
            ?.name ?? "";

    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setDescription(task.description ?? "");
    }, [task]);

    useEffect(() => {
        setActivityOpen(false);
    }, [task?.id]);

    const commitTitle = () => {
        if (!task || !canEdit) return;
        const next = title.trim();
        if (!next || next === task.title) {
            setTitle(task.title);
            return;
        }
        updateTaskDetails(task.id, { title: next });
    };

    const commitDescription = () => {
        if (!task || !canEdit) return;
        const next = description;
        const current = task.description ?? "";
        if (next === current) return;
        if (!isRichTextWithinLimit(next, TASK_DESCRIPTION_MAX_LENGTH)) {
            toast.error(t("fields.descriptionTooLong"));
            setDescription(current);
            return;
        }
        updateTaskDetails(task.id, {
            description: next.length > 0 ? next : undefined,
        });
    };

    const handleArchive = async () => {
        if (!task || isArchiving || isArchived) return;
        const { id, key } = task;
        setIsArchiving(true);
        // Clear first so archived-query fallback cannot reopen the drawer.
        clearSelectedTask();
        try {
            await archiveTask(id);
            toast.success(t("archive.archived", { key }));
        } catch {
            toast.error(t("archive.archiveFailed"));
        } finally {
            setIsArchiving(false);
        }
    };

    const handleRestore = async () => {
        if (!task || isRestoring || !isArchived) return;
        setIsRestoring(true);
        try {
            await restoreTask(task.id);
            toast.success(t("archive.restored", { key: task.key }));
        } catch {
            toast.error(t("archive.restoreFailed"));
        } finally {
            setIsRestoring(false);
        }
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
        if (
            !task ||
            isArchived ||
            targetBoardId === boardId ||
            isLoadingMoveColumns
        )
            return;

        setIsLoadingMoveColumns(true);
        try {
            const targetColumns = await fetchBoardColumns(
                projectId,
                targetBoardId
            );
            if (targetColumns.length === 0) {
                toast.error(t("boards.taskMoveFailed"));
                return;
            }

            const sameName = selectedColumn
                ? targetColumns.find(
                      (column) =>
                          column.name.trim().toLowerCase() ===
                          selectedColumn.name.trim().toLowerCase()
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
                moveTarget.columnId
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
                            <DrawerHeader className="border-b border-border p-4 text-left">
                                <p className="text-meta text-muted-foreground">
                                    {task.key}
                                    {isArchived
                                        ? ` · ${t("archive.badge")}`
                                        : undefined}
                                </p>
                                <DrawerTitle className="sr-only">
                                    {task.title}
                                </DrawerTitle>
                                <DrawerDescription className="text-code text-muted-foreground">
                                    {isArchived
                                        ? t("archive.drawerDescription")
                                        : t("drawerDescription")}
                                </DrawerDescription>
                            </DrawerHeader>

                            <div className="scrollbar-board mx-auto flex min-h-0 w-full min-w-7xl max-w-7xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:flex-row md:gap-8">
                                {/* Title and Description */}
                                <div className="flex min-w-0 flex-[2_1_0%] flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <Label
                                            className={FIELD_LABEL_CLASS}
                                            htmlFor="task-title"
                                        >
                                            {t("fields.title")}
                                        </Label>
                                        <Input
                                            className="h-auto text-h3 font-semibold"
                                            disabled={!canEdit}
                                            id="task-title"
                                            maxLength={TASK_TITLE_MAX_LENGTH}
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
                                            className={FIELD_LABEL_CLASS}
                                            htmlFor="task-description"
                                            id="task-description-label"
                                        >
                                            {t("fields.description")}
                                        </Label>
                                        <RichTextEditor
                                            id="task-description"
                                            maxLength={
                                                TASK_DESCRIPTION_MAX_LENGTH
                                            }
                                            onBlur={commitDescription}
                                            onChange={setDescription}
                                            onUploadImage={
                                                canEdit
                                                    ? (file) =>
                                                          uploadTaskMedia(
                                                              file,
                                                              task.id
                                                          )
                                                    : undefined
                                            }
                                            placeholder={t(
                                                "fields.descriptionPlaceholder"
                                            )}
                                            readOnly={!canEdit}
                                            value={description}
                                        />
                                    </div>

                                    <TaskCommentsSection
                                        projectId={projectId}
                                        readOnly={isArchived}
                                        taskId={task.id}
                                    />

                                    <TaskActivitySection
                                        onOpenChange={setActivityOpen}
                                        open={activityOpen}
                                        taskId={task.id}
                                    />
                                </div>
                                <Separator
                                    className="hidden shrink-0 md:block"
                                    orientation="vertical"
                                />
                                {/* Type, Status, Priority, Deadline */}
                                <div className="flex min-w-0 flex-[1_1_0%] flex-col gap-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-type"
                                            >
                                                {t("fields.type")}
                                            </Label>
                                            <Select
                                                disabled={!canEdit}
                                                onValueChange={(value) => {
                                                    updateTaskDetails(task.id, {
                                                        type: value as TaskType,
                                                    });
                                                }}
                                                value={task.type}
                                            >
                                                <SelectTrigger
                                                    className={
                                                        FIELD_CONTROL_CLASS
                                                    }
                                                    id="task-type"
                                                >
                                                    <span>
                                                        {t(
                                                            `taskType.${task.type}`
                                                        )}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent
                                                    alignItemWithTrigger={false}
                                                >
                                                    {TASK_TYPES.map((type) => (
                                                        <SelectItem
                                                            key={type}
                                                            value={type}
                                                        >
                                                            {t(
                                                                `taskType.${type}`
                                                            )}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-status"
                                            >
                                                {t("fields.status")}
                                            </Label>
                                            <Combobox
                                                disabled={!canEdit}
                                                isItemEqualToValue={(a, b) =>
                                                    a.id === b.id
                                                }
                                                items={columns}
                                                itemToStringLabel={(item) =>
                                                    item.name
                                                }
                                                onValueChange={(value) => {
                                                    if (value && canEdit) {
                                                        updateTaskStatus(
                                                            task.id,
                                                            value.id
                                                        );
                                                    }
                                                }}
                                                value={selectedColumn ?? null}
                                            >
                                                <ComboboxInput
                                                    className={
                                                        FIELD_CONTROL_CLASS
                                                    }
                                                    id="task-status"
                                                />
                                                <ComboboxContent>
                                                    <ComboboxEmpty>
                                                        {t("columns.noResults")}
                                                    </ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(
                                                            column: BoardColumn
                                                        ) => (
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
                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-board"
                                                >
                                                    {t("fields.board")}
                                                </Label>
                                                <Select
                                                    disabled={
                                                        !canEdit ||
                                                        isLoadingMoveColumns ||
                                                        isMoving
                                                    }
                                                    onValueChange={(value) => {
                                                        if (
                                                            typeof value !==
                                                                "string" ||
                                                            value === boardId
                                                        ) {
                                                            return;
                                                        }
                                                        void openMoveToBoard(
                                                            value
                                                        );
                                                    }}
                                                    value={boardId}
                                                >
                                                    <SelectTrigger
                                                        className={
                                                            FIELD_CONTROL_CLASS
                                                        }
                                                        id="task-board"
                                                    >
                                                        <span>
                                                            {currentBoard?.name ??
                                                                t(
                                                                    "boards.loading"
                                                                )}
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

                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-priority"
                                            >
                                                {t("fields.priority")}
                                            </Label>
                                            <Select
                                                disabled={!canEdit}
                                                onValueChange={(value) => {
                                                    if (
                                                        typeof value !==
                                                        "string"
                                                    ) {
                                                        return;
                                                    }
                                                    updateTaskDetails(task.id, {
                                                        priority:
                                                            value ===
                                                            PRIORITY_NONE
                                                                ? undefined
                                                                : (value as TaskPriority),
                                                    });
                                                }}
                                                value={
                                                    task.priority ??
                                                    PRIORITY_NONE
                                                }
                                            >
                                                <SelectTrigger
                                                    className={
                                                        FIELD_CONTROL_CLASS
                                                    }
                                                    id="task-priority"
                                                >
                                                    <span>
                                                        {task.priority
                                                            ? t(
                                                                  `priority.${task.priority}`
                                                              )
                                                            : t(
                                                                  "priority.none"
                                                              )}
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent
                                                    alignItemWithTrigger={false}
                                                >
                                                    <SelectItem
                                                        value={PRIORITY_NONE}
                                                    >
                                                        {t("priority.none")}
                                                    </SelectItem>
                                                    {TASK_PRIORITIES.map(
                                                        (priority) => (
                                                            <SelectItem
                                                                key={priority}
                                                                value={priority}
                                                            >
                                                                {t(
                                                                    `priority.${priority}`
                                                                )}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-deadline"
                                            >
                                                {t("fields.deadline")}
                                            </Label>
                                            <TaskDeadlineField
                                                disabled={!canEdit}
                                                id="task-deadline"
                                                onChange={(deadline) => {
                                                    updateTaskDetails(task.id, {
                                                        deadline,
                                                    });
                                                }}
                                                value={task.deadline}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-author"
                                            >
                                                {t("fields.author")}
                                            </Label>
                                            <TaskMemberField
                                                disabled={!canEdit}
                                                id="task-author"
                                                onChange={(author) => {
                                                    updateTaskDetails(task.id, {
                                                        author,
                                                    });
                                                }}
                                                projectId={projectId}
                                                value={task.author}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                                htmlFor="task-assignee"
                                            >
                                                {t("fields.assignee")}
                                            </Label>
                                            <TaskMemberField
                                                disabled={!canEdit}
                                                id="task-assignee"
                                                onChange={(assignee) => {
                                                    updateTaskDetails(task.id, {
                                                        assignee,
                                                    });
                                                }}
                                                projectId={projectId}
                                                value={task.assignee}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label className={FIELD_LABEL_CLASS}>
                                            {t("fields.labels")}
                                        </Label>
                                        <TaskLabelsField
                                            disabled={!canEdit}
                                            labels={projectLabels}
                                            onLabelIdsChange={(labelIds) => {
                                                updateTaskDetails(task.id, {
                                                    labelIds,
                                                });
                                            }}
                                            projectId={projectId}
                                            selectedIds={task.labelIds ?? []}
                                        />
                                    </div>

                                    {isArchived ? (
                                        task.branchName || task.pr ? (
                                            <GithubTaskMeta
                                                branchName={task.branchName}
                                                pr={task.pr}
                                            />
                                        ) : undefined
                                    ) : (
                                        <TaskGithubPanel
                                            allowedHeadPatterns={
                                                currentBoard?.allowedHeadPatterns ??
                                                []
                                            }
                                            baseBranch={
                                                currentBoard?.baseBranch ??
                                                "main"
                                            }
                                            githubToken={githubToken}
                                            onBranchChange={(branchName) => {
                                                updateTaskDetails(task.id, {
                                                    branchName,
                                                });
                                            }}
                                            onPrChange={(pr) => {
                                                updateTaskDetails(task.id, {
                                                    pr,
                                                });
                                            }}
                                            repoFullName={repoFullName}
                                            task={task}
                                        />
                                    )}

                                    {/* Live Git data — only when branch is set and token available */}
                                    {task.branchName &&
                                        githubToken &&
                                        repoFullName && (
                                            <TaskGitTab
                                                branchName={task.branchName}
                                                isShared={isSharedBranch(
                                                    task.branchName
                                                )}
                                                repoFullName={repoFullName}
                                                token={githubToken}
                                            />
                                        )}

                                    <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                                        {canDeleteTasks && !isArchived ? (
                                            <Button
                                                className="w-full"
                                                disabled={isArchiving}
                                                onClick={() => {
                                                    void handleArchive();
                                                }}
                                                type="button"
                                                variant="outline"
                                            >
                                                <Archive data-icon="inline-start" />
                                                {t("archive.action")}
                                            </Button>
                                        ) : undefined}
                                        {canDeleteTasks && isArchived ? (
                                            <>
                                                <Button
                                                    className="w-full"
                                                    disabled={isRestoring}
                                                    onClick={() => {
                                                        void handleRestore();
                                                    }}
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    <RotateCcw data-icon="inline-start" />
                                                    {t("archive.restore")}
                                                </Button>
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
                                            </>
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
                                            : current
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

const DEADLINE_START_MONTH = new Date(2000, 0);
const DEADLINE_END_MONTH = new Date(new Date().getFullYear() + 10, 11);

type TaskDeadlineFieldProperties = {
    disabled?: boolean;
    id: string;
    onChange: (deadline: null | string) => void;
    value?: string;
};

function TaskDeadlineField({
    disabled = false,
    id,
    onChange,
    value,
}: TaskDeadlineFieldProperties) {
    const { i18n, t } = useTranslation("board");
    const [open, setOpen] = useState(false);
    const selected = value ? parseIsoDate(value) : undefined;
    const locale = i18n.language.startsWith("ru") ? ru : enUS;

    return (
        <div className="flex gap-1.5">
            <Popover
                onOpenChange={(next) => {
                    if (disabled) return;
                    setOpen(next);
                }}
                open={open}
            >
                <PopoverTrigger
                    render={
                        <Button
                            className={cn(
                                FIELD_CONTROL_CLASS,
                                "flex-1 justify-start font-normal",
                                !selected && "text-muted-foreground"
                            )}
                            disabled={disabled}
                            id={id}
                            variant="outline"
                        />
                    }
                >
                    <CalendarIcon data-icon="inline-start" />
                    <span className="truncate">
                        {selected && value
                            ? formatDeadlineLong(value, i18n.language)
                            : t("fields.deadlinePlaceholder")}
                    </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                        captionLayout="dropdown"
                        disabled={disabled}
                        endMonth={DEADLINE_END_MONTH}
                        locale={locale}
                        mode="single"
                        onSelect={(date) => {
                            if (!date) return;
                            onChange(toIsoDate(date));
                            setOpen(false);
                        }}
                        selected={selected}
                        startMonth={DEADLINE_START_MONTH}
                    />
                </PopoverContent>
            </Popover>
            {selected && !disabled ? (
                <Button
                    aria-label={t("fields.deadlineClear")}
                    onClick={() => {
                        onChange(null);
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                >
                    <XIcon />
                </Button>
            ) : undefined}
        </div>
    );
}
