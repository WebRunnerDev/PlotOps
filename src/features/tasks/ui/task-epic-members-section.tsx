import { useQueries } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { BoardColumn } from "@/features/boards";
import type { Task } from "@/features/tasks/model/types";

import { useBoardColumns, useProjectBoards } from "@/features/boards";
import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { boardKeys } from "@/features/boards/model/query-keys";
import { isGuest } from "@/features/guest-mode";
import { useProjectLabels } from "@/features/labels";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import {
    EPIC_RULE_TOAST_KEY,
    epicRefusalFromError,
} from "@/features/tasks/lib/epic-rules";
import {
    EPIC_COLOR_SWATCH_CLASS,
    TASK_TITLE_MAX_LENGTH,
} from "@/features/tasks/model/constants";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectEpics } from "@/features/tasks/model/use-project-epics";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { TaskSearchPicker } from "@/features/tasks/ui/task-search-picker";
import { TaskTypeIcon } from "@/features/tasks/ui/task-type-icon";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type AddMode = "create" | "link" | null;

/**
 * Tasks in an Epic (all Boards) with rollup progress — the Epic drawer's
 * counterpart to the Subtasks section.
 */
export function TaskEpicMembersSection({
    boardId,
    canCreate,
    canEdit,
    epic,
    projectId,
}: {
    boardId: string;
    /** Manager+ — creating a root Task. */
    canCreate: boolean;
    /** Contributor+ — adding / removing existing Tasks. */
    canEdit: boolean;
    epic: Task;
    projectId: string;
}) {
    const { t } = useTranslation("board");
    const { createTask, updateTaskDetails } = useBoardTasks(projectId, boardId);
    const { columns } = useBoardColumns(projectId, boardId);
    const { data: projectTasks = [] } = useProjectTasks(projectId);
    const { epicsById } = useProjectEpics(projectId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const { labels } = useProjectLabels(projectId);
    const people = useProjectPeople(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const boardsProvider = resolveBoardsProvider(isGuest());
    const columnQueries = useQueries({
        queries: boards.map((board) => ({
            enabled: Boolean(projectId && board.id),
            queryFn: () =>
                boardsProvider.fetchBoardColumns(projectId, board.id),
            queryKey: boardKeys.columns(projectId, board.id),
        })),
    });
    const [addMode, setAddMode] = useState<AddMode>(null);
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const columnsByBoardId = useMemo(() => {
        const map = new Map<string, BoardColumn[]>();
        for (const [index, board] of boards.entries()) {
            map.set(board.id, columnQueries[index]?.data ?? []);
        }
        return map;
    }, [boards, columnQueries]);

    const members = useMemo(
        () => projectTasks.filter((task) => task.epicId === epic.id),
        [epic.id, projectTasks]
    );
    const candidates = useMemo(
        () =>
            projectTasks.filter(
                (task) =>
                    task.type !== "epic" &&
                    task.parentId === undefined &&
                    task.epicId !== epic.id
            ),
        [epic.id, projectTasks]
    );
    const progress = epicsById.get(epic.id);
    const done = progress?.doneCount ?? 0;
    const total = progress?.taskCount ?? members.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const isArchived = Boolean(epic.archivedAt);
    const firstColumnId = columns[0]?.id;

    const toastEpicError = (error: unknown, fallbackKey: string) => {
        const reason = epicRefusalFromError(error);
        toast.error(t(reason ? EPIC_RULE_TOAST_KEY[reason] : fallbackKey));
    };

    const submitCreate = async () => {
        const trimmed = title.trim();
        if (!trimmed || !firstColumnId || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const created = await createTask(firstColumnId, trimmed, {
                epicId: epic.id,
                taskType: "story",
            });
            toast.success(t("epics.taskCreated", { key: created.key }));
            setTitle("");
            setAddMode(null);
        } catch (error) {
            toastEpicError(error, "epics.taskCreateFailed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const linkExisting = (task: Task) => {
        updateTaskDetails(task.id, { epicId: epic.id });
        toast.success(t("epics.addedToEpic", { count: 1, title: epic.title }));
        setAddMode(null);
    };

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                    {t("epics.members")}
                </h3>
                {isArchived ? undefined : addMode ? (
                    <Button
                        className="h-8 px-2 text-muted-foreground"
                        disabled={isSubmitting}
                        onClick={() => {
                            setAddMode(null);
                            setTitle("");
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        {t("subtasks.cancel")}
                    </Button>
                ) : (
                    <div className="flex shrink-0 items-center gap-1">
                        {canEdit ? (
                            <Button
                                className="h-8 px-2 text-muted-foreground"
                                onClick={() => setAddMode("link")}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                {t("epics.addExisting")}
                            </Button>
                        ) : undefined}
                        {canCreate && firstColumnId ? (
                            <Button
                                className="h-8 gap-1.5 text-muted-foreground"
                                onClick={() => setAddMode("create")}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                <Plus className="size-4 shrink-0" />
                                {t("subtasks.add")}
                            </Button>
                        ) : undefined}
                    </div>
                )}
            </div>

            <div className="flex min-w-0 items-center gap-2">
                <span
                    aria-hidden
                    className="relative h-1.5 w-full overflow-hidden bg-muted"
                >
                    <span
                        className={cn(
                            "absolute inset-y-0 left-0 transition-[width] duration-500 ease-(--ease-out-expo)",
                            EPIC_COLOR_SWATCH_CLASS[epic.epicColor ?? "purple"]
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </span>
                <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                    {t("epics.progress", { done, total })}
                    {progress && progress.pointsTotal > 0
                        ? ` · ${t("epics.points", {
                              done: progress.pointsDone,
                              total: progress.pointsTotal,
                          })}`
                        : ""}
                </span>
            </div>

            {addMode === "create" ? (
                <Input
                    aria-label={t("epics.taskPlaceholder")}
                    autoFocus
                    className="h-8 bg-background font-mono text-code"
                    disabled={isSubmitting}
                    maxLength={TASK_TITLE_MAX_LENGTH}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            void submitCreate();
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            setAddMode(null);
                            setTitle("");
                        }
                    }}
                    placeholder={t("epics.taskPlaceholder")}
                    value={title}
                />
            ) : undefined}

            {addMode === "link" ? (
                <TaskSearchPicker
                    boards={boards}
                    currentBoardId={boardId}
                    emptyText={t("subtasks.linkNoResults")}
                    items={candidates}
                    labels={labels}
                    onSelect={linkExisting}
                    people={people}
                    placeholder={t("subtasks.linkPlaceholder")}
                    projectId={projectId}
                />
            ) : undefined}

            {members.length === 0 ? (
                addMode ? undefined : (
                    <p className="text-ui text-muted-foreground">
                        {t("epics.membersEmpty")}
                    </p>
                )
            ) : (
                <ul className="flex flex-col gap-1">
                    {members.map((member) => {
                        const memberColumns =
                            columnsByBoardId.get(member.boardId) ?? [];
                        const column = memberColumns.find(
                            (item) => item.id === member.status
                        );
                        return (
                            <li
                                className="group/member flex min-w-0 items-center gap-1"
                                key={member.id}
                            >
                                <button
                                    aria-label={member.key}
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-none border border-border px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
                                    onClick={() => selectTask(member.id)}
                                    type="button"
                                >
                                    <TaskTypeIcon
                                        label={t(`taskType.${member.type}`)}
                                        type={member.type}
                                    />
                                    <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                        {member.key}
                                    </span>
                                    <span
                                        className={cn(
                                            "min-w-0 flex-1 truncate text-ui",
                                            column?.isDone &&
                                                "text-muted-foreground line-through"
                                        )}
                                    >
                                        {member.title}
                                    </span>
                                    <span
                                        className="max-w-28 shrink-0 truncate text-meta text-muted-foreground"
                                        title={t("fields.status")}
                                    >
                                        {column?.name ?? member.status}
                                    </span>
                                </button>
                                {canEdit && !isArchived ? (
                                    <Button
                                        aria-label={t("epics.removeFromEpic", {
                                            key: member.key,
                                        })}
                                        className="shrink-0 rounded-none text-muted-foreground opacity-0 transition-opacity group-hover/member:opacity-100 focus-visible:opacity-100"
                                        onClick={() => {
                                            updateTaskDetails(member.id, {
                                                epicId: null,
                                            });
                                        }}
                                        size="icon-sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <X />
                                    </Button>
                                ) : undefined}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
