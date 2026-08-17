import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    Archive,
    CalendarIcon,
    Check,
    Copy,
    RotateCcw,
    Trash2,
    XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { enUS, ru } from "react-day-picker/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    TaskPriority,
    TaskStatus,
    TaskType,
} from "@/features/tasks/model/types";
import type { MentionCandidate } from "@/shared/ui/rich-text-editor";

import {
    type BoardColumn,
    boardKeys,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { canFetchTaskGitTab } from "@/features/git-integration/lib/can-fetch-git-data";
import { TaskGitTab } from "@/features/git-integration/ui/task-git-tab";
import { isGuest } from "@/features/guest-mode";
import { TaskLabelsField, useProjectLabels } from "@/features/labels";
import { TaskWatchersList } from "@/features/notifications/ui/task-watchers-list";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import { isSharedBranch } from "@/features/tasks/lib/format-branch";
import {
    formatDeadlineLong,
    parseIsoDate,
    toIsoDate,
} from "@/features/tasks/lib/format-deadline";
import { formatTaskCopyText } from "@/features/tasks/lib/format-task-copy-text";
import { remapTaskStatusForBoard } from "@/features/tasks/lib/remap-task-status-for-board";
import { resolveCachedTaskBoardId } from "@/features/tasks/lib/resolve-cached-task-board-id";
import { TASK_ESTIMATE_VALUES } from "@/features/tasks/lib/task-estimate";
import {
    PARENT_GATE_TOAST_KEY,
    parentGateRefusalFromError,
    subtasksOf,
    taskDoneRefusalFromError,
} from "@/features/tasks/lib/task-structure";
import { toastTaskDoneRefusal } from "@/features/tasks/lib/toast-task-done-refusal";
import {
    TASK_DESCRIPTION_MAX_LENGTH,
    TASK_PRIORITIES,
    TASK_TITLE_MAX_LENGTH,
    TASK_TYPES,
} from "@/features/tasks/model/constants";
import { useArchivedTasks } from "@/features/tasks/model/use-archived-tasks";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { GithubTaskMeta } from "@/features/tasks/ui/github-task-meta";
import { TaskActivitySection } from "@/features/tasks/ui/task-activity-section";
import { TaskCommentsSection } from "@/features/tasks/ui/task-comments-section";
import { TaskGithubPanel } from "@/features/tasks/ui/task-github-panel";
import { TaskLinksSection } from "@/features/tasks/ui/task-links-section";
import { TaskMemberField } from "@/features/tasks/ui/task-member-field";
import { TaskSubtasksSection } from "@/features/tasks/ui/task-subtasks-section";
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

/** Mobile: bottom sheet (swipe down + snap). Desktop: same shell, two-column body at md+. */
const TASK_DRAWER_SNAP_POINTS = ["32rem", 0.92] as const;
const PRIORITY_NONE = "__none__";
const ESTIMATE_NONE = "__none__";
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
    const isGuestSessionActive = isGuest();
    const queryClient = useQueryClient();
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const { columns } = useBoardColumns(projectId, boardId);
    const { labels } = useProjectLabels(projectId);
    const {
        archiveTask,
        clearTaskParent,
        deleteTask,
        isLoading: isBoardTasksLoading,
        moveTaskToOtherBoard,
        restoreTask,
        tasks,
        updateTaskDetails,
        updateTaskStatus,
    } = useBoardTasks(projectId, boardId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const navigate = useNavigate();
    const {
        canCreateTasks,
        canDeleteTasks,
        canEditEstimate,
        canEditTasks,
        canManageBoard,
        isSettled,
    } = useProjectAccess(projectId);
    const people = useProjectPeople(projectId);
    const mentionCandidates = useMemo<MentionCandidate[]>(
        () => people.map((person) => ({ id: person.id, label: person.name })),
        [people]
    );
    const clearSelectedTask = useTasksUiStore(
        (state) => state.clearSelectedTask
    );
    const selectTask = useTasksUiStore((state) => state.selectTask);

    const boardTask = tasks.find((item) => item.id === selectedTaskId);
    const lookupMissingOnBoard =
        Boolean(selectedTaskId) && !boardTask && !isBoardTasksLoading;
    const archivedQuery = useArchivedTasks(
        projectId,
        boardId,
        lookupMissingOnBoard
    );
    const archivedTasks = archivedQuery.data ?? [];
    const archivedTask = archivedTasks.find(
        (item) => item.id === selectedTaskId
    );
    const cachedOtherBoardId =
        selectedTaskId && lookupMissingOnBoard && !archivedTask
            ? resolveCachedTaskBoardId(queryClient, projectId, selectedTaskId)
            : undefined;
    const { data: projectTasks = [] } = useProjectTasks(
        projectId,
        lookupMissingOnBoard &&
            archivedQuery.isFetched &&
            !archivedTask &&
            !cachedOtherBoardId,
        { includeArchived: true }
    );
    const task = boardTask ?? archivedTask;
    const currentBoard = boards.find((board) => board.id === task?.boardId);
    const isArchived = Boolean(task?.archivedAt);
    const canEdit = isSettled && canEditTasks && !isArchived;
    const canSetEstimate = isSettled && canEditEstimate && !isArchived;
    const canDelete = isSettled && canDeleteTasks;
    const allowCreateLabels = isSettled && canManageBoard;
    const canAddSubtask = canEdit && task?.parentId == undefined;
    const movingSubtaskCount =
        task && task.parentId == undefined
            ? subtasksOf(task.id, tasks).filter(
                  (child) => child.archivedAt == undefined
              ).length
            : 0;
    const canRemoveParent =
        isSettled &&
        canCreateTasks &&
        !isArchived &&
        task?.parentId != undefined;

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [titleDirty, setTitleDirty] = useState(false);
    const [descriptionDirty, setDescriptionDirty] = useState(false);
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
    const [copiedTaskText, setCopiedTaskText] = useState(false);
    const previousTaskLinkReference = useRef<
        undefined | { id: string; parentId?: string }
    >(undefined);
    const drawerBodyReference = useRef<HTMLDivElement>(null);
    const previousTaskLink = previousTaskLinkReference.current;
    const shouldAnimateTaskSwap = Boolean(task && previousTaskLink);
    const taskSwapDirection =
        task && previousTaskLink
            ? task.parentId === previousTaskLink.id
                ? "forward"
                : previousTaskLink.parentId === task.id
                  ? "back"
                  : "forward"
            : "forward";

    const selectedColumn = columns.find((column) => column.id === task?.status);
    const moveToColumnName =
        moveTarget?.columns.find((column) => column.id === moveTarget.columnId)
            ?.name ?? "";

    useEffect(() => {
        if (!task) return;
        setTitle(task.title);
        setDescription(task.description ?? "");
        setTitleDirty(false);
        setDescriptionDirty(false);
    }, [task?.id]);

    useEffect(() => {
        if (!task || titleDirty) return;
        setTitle(task.title);
    }, [task?.title, task?.id, titleDirty]);

    useEffect(() => {
        if (!task || descriptionDirty) return;
        setDescription(task.description ?? "");
    }, [task?.description, task?.id, descriptionDirty]);

    useEffect(() => {
        setActivityOpen(false);
        setCopiedTaskText(false);
        drawerBodyReference.current?.scrollTo({ top: 0 });
        if (!task) {
            previousTaskLinkReference.current = undefined;
            return;
        }
        previousTaskLinkReference.current = {
            id: task.id,
            parentId: task.parentId,
        };
    }, [task?.id]);

    useEffect(() => {
        if (!selectedTaskId || boardTask || isBoardTasksLoading) return;
        if (archivedTask) return;

        const targetBoardId =
            cachedOtherBoardId && cachedOtherBoardId !== boardId
                ? cachedOtherBoardId
                : projectTasks.find((item) => item.id === selectedTaskId)
                      ?.boardId;
        if (!targetBoardId || targetBoardId === boardId) return;

        void navigate({
            params: {
                boardId: targetBoardId,
                projectId,
            },
            to: "/projects/$projectId/boards/$boardId",
        });
    }, [
        archivedTask,
        boardId,
        boardTask,
        cachedOtherBoardId,
        isBoardTasksLoading,
        navigate,
        projectId,
        projectTasks,
        selectedTaskId,
    ]);

    const handleCopyTaskText = async () => {
        const payload = formatTaskCopyText(title, description);
        if (!payload) return;

        try {
            await navigator.clipboard.writeText(payload);
            setCopiedTaskText(true);
            toast.success(t("fields.copiedTitleAndDescription"));
            globalThis.setTimeout(() => setCopiedTaskText(false), 1500);
        } catch {
            toast.error(t("copyFailed"));
        }
    };

    const commitTitle = () => {
        if (!task || !canEdit) return;
        const next = title.trim();
        if (!next || next === task.title) {
            setTitle(task.title);
            setTitleDirty(false);
            return;
        }
        setTitleDirty(false);
        updateTaskDetails(task.id, { title: next });
    };

    const commitDescription = () => {
        if (!task || !canEdit) return;
        const next = description;
        const current = task.description ?? "";
        if (next === current) {
            setDescriptionDirty(false);
            return;
        }
        if (!isRichTextWithinLimit(next, TASK_DESCRIPTION_MAX_LENGTH)) {
            toast.error(t("fields.descriptionTooLong"));
            setDescription(current);
            setDescriptionDirty(false);
            return;
        }
        setDescriptionDirty(false);
        updateTaskDetails(task.id, {
            description: next.length > 0 ? next : null,
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
        } catch (error) {
            const reason = parentGateRefusalFromError(error);
            toast.error(
                reason
                    ? t(PARENT_GATE_TOAST_KEY[reason])
                    : t("archive.archiveFailed")
            );
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
        } catch (error) {
            const reason = parentGateRefusalFromError(error);
            toast.error(
                reason
                    ? t(PARENT_GATE_TOAST_KEY[reason])
                    : t("tasks.deleteFailed")
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const openMoveToBoard = async (targetBoardId: string) => {
        if (
            !task ||
            isArchived ||
            targetBoardId === task.boardId ||
            isLoadingMoveColumns
        )
            return;

        setIsLoadingMoveColumns(true);
        try {
            const targetColumns = await resolveBoardsProvider(
                isGuestSessionActive
            ).fetchBoardColumns(projectId, targetBoardId);
            if (targetColumns.length === 0) {
                toast.error(t("boards.taskMoveFailed"));
                return;
            }

            queryClient.setQueryData(
                boardKeys.columns(projectId, targetBoardId),
                targetColumns
            );

            const remappedStatus = remapTaskStatusForBoard(
                task.status,
                columns,
                targetColumns
            );

            setMoveTarget({
                boardId: targetBoardId,
                boardName:
                    boards.find((board) => board.id === targetBoardId)?.name ??
                    "",
                columnId: remappedStatus,
                columns: targetColumns.map((column) => ({
                    id: column.id as TaskStatus,
                    isDone: column.isDone,
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
                moveToColumnName
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
        } catch (error) {
            const doneReason = taskDoneRefusalFromError(error);
            if (doneReason) {
                toastTaskDoneRefusal(t, doneReason);
                return;
            }
            const reason = parentGateRefusalFromError(error);
            toast.error(
                reason
                    ? t(PARENT_GATE_TOAST_KEY[reason])
                    : t("boards.taskMoveFailed")
            );
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
                        const selectedIsOnThisBoard = Boolean(
                            selectedTaskId && (boardTask || archivedTask)
                        );
                        if (selectedIsOnThisBoard || !selectedTaskId) {
                            clearSelectedTask();
                        }
                    }
                }}
                open={Boolean(task)}
                showSwipeHandle
                snapPoints={[...TASK_DRAWER_SNAP_POINTS]}
                swipeDirection="down"
            >
                <DrawerContent>
                    {task ? (
                        <div
                            className={cn(
                                "flex min-h-0 flex-1 flex-col",
                                shouldAnimateTaskSwap &&
                                    "animate-in fade-in-0 duration-200 motion-reduce:animate-none",
                                shouldAnimateTaskSwap &&
                                    (taskSwapDirection === "back"
                                        ? "slide-in-from-left-4"
                                        : "slide-in-from-right-4")
                            )}
                            key={task.id}
                        >
                            <DrawerHeader
                                className={cn(
                                    "shrink-0 border-b border-border p-4 text-left",
                                    isArchived &&
                                        "bg-linear-to-t from-amber-500/50 to-transparent dark:from-amber-900/50 dark:to-transparent"
                                )}
                            >
                                <p className="flex min-w-0 flex-wrap items-center gap-2 text-meta text-muted-foreground">
                                    <span>{task.key}</span>
                                    {task.parentKey && task.parentId ? (
                                        <button
                                            aria-label={t(
                                                "subtasks.openParent",
                                                {
                                                    key: task.parentKey,
                                                }
                                            )}
                                            className="truncate font-mono outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                            onClick={() => {
                                                selectTask(task.parentId!);
                                            }}
                                            type="button"
                                        >
                                            {t("subtasks.parentBadge", {
                                                key: task.parentKey,
                                            })}
                                        </button>
                                    ) : undefined}
                                    {canRemoveParent ? (
                                        <Button
                                            className="h-7 px-2 text-meta"
                                            onClick={() => {
                                                void (async () => {
                                                    try {
                                                        await clearTaskParent(
                                                            task.id
                                                        );
                                                        toast.success(
                                                            t(
                                                                "subtasks.removedParent",
                                                                {
                                                                    key: task.key,
                                                                }
                                                            )
                                                        );
                                                    } catch {
                                                        toast.error(
                                                            t(
                                                                "subtasks.removeParentFailed"
                                                            )
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

                            <div
                                className="scrollbar-board min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pt-4 pb-8"
                                ref={drawerBodyReference}
                            >
                                <div className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-1 gap-6 md:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)] md:items-stretch md:gap-8">
                                    {/* Title and Description */}
                                    <div className="flex min-w-0 flex-col gap-6">
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <div className="flex min-w-0 items-center justify-between gap-3">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-title"
                                                >
                                                    {t("fields.title")}
                                                </Label>
                                                <Button
                                                    className="shrink-0"
                                                    onClick={() => {
                                                        void handleCopyTaskText();
                                                    }}
                                                    size="sm"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {copiedTaskText ? (
                                                        <Check
                                                            className="text-emerald-500"
                                                            data-icon="inline-start"
                                                        />
                                                    ) : (
                                                        <Copy data-icon="inline-start" />
                                                    )}
                                                    <span className="hidden sm:inline">
                                                        {t(
                                                            "fields.copyTitleAndDescription"
                                                        )}
                                                    </span>
                                                    <span className="sm:hidden">
                                                        {t("fields.copy")}
                                                    </span>
                                                </Button>
                                            </div>
                                            <Input
                                                className="h-auto min-w-0 text-h3 font-semibold"
                                                disabled={!canEdit}
                                                id="task-title"
                                                maxLength={
                                                    TASK_TITLE_MAX_LENGTH
                                                }
                                                onBlur={commitTitle}
                                                onChange={(event) => {
                                                    setTitleDirty(true);
                                                    setTitle(
                                                        event.target.value
                                                    );
                                                }}
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
                                                mentionCandidates={
                                                    canEdit
                                                        ? mentionCandidates
                                                        : undefined
                                                }
                                                onBlur={commitDescription}
                                                onChange={(value) => {
                                                    setDescriptionDirty(true);
                                                    setDescription(value);
                                                }}
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

                                        {task.parentId == undefined ? (
                                            <TaskSubtasksSection
                                                boardId={boardId}
                                                canAdd={canAddSubtask}
                                                parent={task}
                                                projectId={projectId}
                                            />
                                        ) : undefined}

                                        <TaskLinksSection
                                            boardId={boardId}
                                            canEdit={canEdit}
                                            projectId={projectId}
                                            task={task}
                                        />

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
                                        className="hidden md:block"
                                        orientation="vertical"
                                    />
                                    {/* Type, Status, Priority, Deadline */}
                                    <div className="flex min-w-0 flex-col gap-5">
                                        <div className="grid min-w-0 grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-type"
                                                >
                                                    {t("fields.type")}
                                                </Label>
                                                <Select
                                                    disabled={!canEdit}
                                                    onValueChange={(value) => {
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                type: value as TaskType,
                                                            }
                                                        );
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
                                                        alignItemWithTrigger={
                                                            false
                                                        }
                                                    >
                                                        {TASK_TYPES.map(
                                                            (type) => (
                                                                <SelectItem
                                                                    key={type}
                                                                    value={type}
                                                                >
                                                                    {t(
                                                                        `taskType.${type}`
                                                                    )}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-status"
                                                >
                                                    {t("fields.status")}
                                                </Label>
                                                {isArchived ? (
                                                    <Input
                                                        className={
                                                            FIELD_CONTROL_CLASS
                                                        }
                                                        disabled
                                                        id="task-status"
                                                        readOnly
                                                        value={t(
                                                            "archive.badge"
                                                        )}
                                                    />
                                                ) : (
                                                    <Combobox
                                                        disabled={!canEdit}
                                                        isItemEqualToValue={(
                                                            a,
                                                            b
                                                        ) => a.id === b.id}
                                                        items={columns}
                                                        itemToStringLabel={(
                                                            item
                                                        ) => item.name}
                                                        onValueChange={(
                                                            value
                                                        ) => {
                                                            if (
                                                                value &&
                                                                canEdit
                                                            ) {
                                                                updateTaskStatus(
                                                                    task.id,
                                                                    value.id
                                                                );
                                                            }
                                                        }}
                                                        value={
                                                            selectedColumn ??
                                                            null
                                                        }
                                                    >
                                                        <ComboboxInput
                                                            className={
                                                                FIELD_CONTROL_CLASS
                                                            }
                                                            id="task-status"
                                                        />
                                                        <ComboboxContent>
                                                            <ComboboxEmpty>
                                                                {t(
                                                                    "columns.noResults"
                                                                )}
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(
                                                                    column: BoardColumn
                                                                ) => (
                                                                    <ComboboxItem
                                                                        key={
                                                                            column.id
                                                                        }
                                                                        value={
                                                                            column
                                                                        }
                                                                    >
                                                                        {
                                                                            column.name
                                                                        }
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                )}
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
                                                        key={task.id}
                                                        onValueChange={(
                                                            value
                                                        ) => {
                                                            if (
                                                                typeof value !==
                                                                    "string" ||
                                                                value ===
                                                                    task.boardId
                                                            ) {
                                                                return;
                                                            }
                                                            void openMoveToBoard(
                                                                value
                                                            );
                                                        }}
                                                        value={task.boardId}
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
                                                            {boards.map(
                                                                (board) => (
                                                                    <SelectItem
                                                                        key={
                                                                            board.id
                                                                        }
                                                                        value={
                                                                            board.id
                                                                        }
                                                                    >
                                                                        {
                                                                            board.name
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : undefined}

                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
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
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                priority:
                                                                    value ===
                                                                    PRIORITY_NONE
                                                                        ? null
                                                                        : (value as TaskPriority),
                                                            }
                                                        );
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
                                                        alignItemWithTrigger={
                                                            false
                                                        }
                                                    >
                                                        <SelectItem
                                                            value={
                                                                PRIORITY_NONE
                                                            }
                                                        >
                                                            {t("priority.none")}
                                                        </SelectItem>
                                                        {TASK_PRIORITIES.map(
                                                            (priority) => (
                                                                <SelectItem
                                                                    key={
                                                                        priority
                                                                    }
                                                                    value={
                                                                        priority
                                                                    }
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
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-estimate"
                                                >
                                                    {t("fields.estimate")}
                                                </Label>
                                                <Select
                                                    disabled={!canSetEstimate}
                                                    onValueChange={(value) => {
                                                        if (
                                                            typeof value !==
                                                            "string"
                                                        ) {
                                                            return;
                                                        }
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                estimate:
                                                                    value ===
                                                                    ESTIMATE_NONE
                                                                        ? null
                                                                        : (Number(
                                                                              value
                                                                          ) as (typeof TASK_ESTIMATE_VALUES)[number]),
                                                            }
                                                        );
                                                    }}
                                                    value={
                                                        task.estimate ===
                                                        undefined
                                                            ? ESTIMATE_NONE
                                                            : String(
                                                                  task.estimate
                                                              )
                                                    }
                                                >
                                                    <SelectTrigger
                                                        className={
                                                            FIELD_CONTROL_CLASS
                                                        }
                                                        id="task-estimate"
                                                    >
                                                        <span>
                                                            {task.estimate ===
                                                            undefined
                                                                ? t(
                                                                      "estimate.none"
                                                                  )
                                                                : t(
                                                                      "estimate.points",
                                                                      {
                                                                          count: task.estimate,
                                                                      }
                                                                  )}
                                                        </span>
                                                    </SelectTrigger>
                                                    <SelectContent
                                                        alignItemWithTrigger={
                                                            false
                                                        }
                                                    >
                                                        <SelectItem
                                                            value={
                                                                ESTIMATE_NONE
                                                            }
                                                        >
                                                            {t("estimate.none")}
                                                        </SelectItem>
                                                        {TASK_ESTIMATE_VALUES.map(
                                                            (points) => (
                                                                <SelectItem
                                                                    key={points}
                                                                    value={String(
                                                                        points
                                                                    )}
                                                                >
                                                                    {t(
                                                                        "estimate.points",
                                                                        {
                                                                            count: points,
                                                                        }
                                                                    )}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-deadline"
                                                >
                                                    {t("fields.deadline")}
                                                </Label>
                                                <TaskDeadlineField
                                                    disabled={!canEdit}
                                                    id="task-deadline"
                                                    onChange={(deadline) => {
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                deadline,
                                                            }
                                                        );
                                                    }}
                                                    value={task.deadline}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-author"
                                                >
                                                    {t("fields.author")}
                                                </Label>
                                                <TaskMemberField
                                                    disabled={!canEdit}
                                                    id="task-author"
                                                    onChange={(author) => {
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                author,
                                                            }
                                                        );
                                                    }}
                                                    projectId={projectId}
                                                    value={task.author}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <Label
                                                    className={
                                                        FIELD_LABEL_CLASS
                                                    }
                                                    htmlFor="task-assignee"
                                                >
                                                    {t("fields.assignee")}
                                                </Label>
                                                <TaskMemberField
                                                    disabled={!canEdit}
                                                    id="task-assignee"
                                                    onChange={(assignee) => {
                                                        updateTaskDetails(
                                                            task.id,
                                                            {
                                                                assignee,
                                                            }
                                                        );
                                                    }}
                                                    projectId={projectId}
                                                    value={task.assignee}
                                                />
                                            </div>
                                        </div>

                                        <TaskWatchersList
                                            projectId={projectId}
                                            taskId={task.id}
                                        />

                                        <div className="flex flex-col gap-1.5">
                                            <Label
                                                className={FIELD_LABEL_CLASS}
                                            >
                                                {t("fields.labels")}
                                            </Label>
                                            <TaskLabelsField
                                                allowCreate={allowCreateLabels}
                                                disabled={!canEdit}
                                                labels={projectLabels}
                                                onLabelIdsChange={(
                                                    labelIds
                                                ) => {
                                                    updateTaskDetails(task.id, {
                                                        labelIds,
                                                    });
                                                }}
                                                projectId={projectId}
                                                selectedIds={
                                                    task.labelIds ?? []
                                                }
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
                                                canEdit={canEdit}
                                                githubToken={githubToken}
                                                onBranchChange={(
                                                    branchName
                                                ) => {
                                                    updateTaskDetails(task.id, {
                                                        branchName,
                                                    });
                                                }}
                                                onLinkedCommitChange={(
                                                    linkedCommitSha
                                                ) => {
                                                    updateTaskDetails(task.id, {
                                                        linkedCommitSha,
                                                    });
                                                }}
                                                onPrChange={(pr) => {
                                                    updateTaskDetails(task.id, {
                                                        pr,
                                                    });
                                                }}
                                                projectId={projectId}
                                                repoFullName={repoFullName}
                                                task={task}
                                            />
                                        )}

                                        {/* Live / fixture Git data — token or guest session */}
                                        {repoFullName &&
                                        canFetchTaskGitTab({
                                            isGuest: isGuestSessionActive,
                                            repoFullName,
                                            taskKey: task.key,
                                            token: githubToken,
                                        }) ? (
                                            <TaskGitTab
                                                branchName={task.branchName}
                                                isShared={
                                                    task.branchName
                                                        ? isSharedBranch(
                                                              task.branchName
                                                          )
                                                        : false
                                                }
                                                linkedCommitSha={
                                                    task.linkedCommitSha
                                                }
                                                repoFullName={repoFullName}
                                                taskKey={task.key}
                                                token={githubToken}
                                            />
                                        ) : undefined}

                                        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
                                            {canDelete && !isArchived ? (
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
                                            {canDelete && isArchived ? (
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
                            </div>
                        </div>
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

                    {movingSubtaskCount > 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("boards.moveWithSubtasks", {
                                count: movingSubtaskCount,
                            })}
                        </p>
                    ) : undefined}

                    {task?.sprintId ? (
                        <p className="text-sm text-muted-foreground">
                            {t("boards.moveClearsSprint")}
                        </p>
                    ) : undefined}

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
                                "flex-1 justify-start border-input bg-background font-normal dark:bg-background aria-expanded:bg-background dark:aria-expanded:bg-background dark:hover:bg-background",
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
