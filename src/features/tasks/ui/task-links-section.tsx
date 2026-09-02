import type { LucideIcon } from "lucide-react";

import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Ban, Link2, Plus, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { BoardColumn } from "@/features/boards";
import type {
    Task,
    TaskLinkKind,
    TaskLinkPeer,
} from "@/features/tasks/model/types";

import {
    resolveBoardsProvider,
    useBoardColumns,
    useProjectBoards,
} from "@/features/boards";
import { boardKeys } from "@/features/boards/model/query-keys";
import { isGuest } from "@/features/guest-mode";
import { useProjectLabels } from "@/features/labels";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import {
    collectTaskLinkCandidates,
    mergeTaskCatalogs,
} from "@/features/tasks/lib/collect-task-link-candidates";
import { TASK_LINK_ERROR } from "@/features/tasks/lib/task-structure";
import { TASK_TITLE_MAX_LENGTH } from "@/features/tasks/model/constants";
import { taskKeys } from "@/features/tasks/model/query-keys";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { TaskSearchPicker } from "@/features/tasks/ui/task-search-picker";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

type AddKind = "blocked_by" | "blocks" | "relates_to";

type AddMode = "create" | "link";

type LinkTone = "blockedBy" | "blocks" | "relates";

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
    const { createTask, createTaskLink, deleteTaskLink } = useBoardTasks(
        projectId,
        boardId
    );
    const { columns } = useBoardColumns(projectId, boardId);
    const { data: projectTasks = [] } = useProjectTasks(projectId);
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
    const boardsProvider = resolveBoardsProvider(isGuest());
    const columnQueries = useQueries({
        queries: boards.map((board) => ({
            enabled: Boolean(projectId && board.id),
            queryFn: () =>
                boardsProvider.fetchBoardColumns(projectId, board.id),
            queryKey: boardKeys.columns(projectId, board.id),
        })),
    });
    const columnsByBoardId = useMemo(() => {
        const map = new Map<string, BoardColumn[]>();
        for (const [index, board] of boards.entries()) {
            map.set(board.id, columnQueries[index]?.data ?? []);
        }
        return map;
    }, [boards, columnQueries]);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [addKind, setAddKind] = useState<AddKind>("relates_to");
    const [addMode, setAddMode] = useState<AddMode>("create");
    const [title, setTitle] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const addFormReference = useRef<HTMLDivElement>(null);
    const inputReference = useRef<HTMLInputElement>(null);
    const skipBlurClose = useRef(false);

    const peers = task.relatedTasks ?? [];
    const blockedBy = peers.filter(
        (peer) => peer.kind === "blocks" && peer.direction === "incoming"
    );
    const blocks = peers.filter(
        (peer) => peer.kind === "blocks" && peer.direction === "outgoing"
    );
    const related = peers.filter((peer) => peer.kind === "relates_to");

    const catalog = useMemo(
        () =>
            mergeTaskCatalogs([
                projectTasks,
                ...boardTaskQueries.map((query) => query.data?.tasks ?? []),
            ]),
        [boardTaskQueries, projectTasks]
    );

    const candidates = useMemo(
        () =>
            collectTaskLinkCandidates({
                addKind,
                peers,
                projectId,
                taskId: task.id,
                tasks: catalog,
            }),
        [addKind, catalog, peers, projectId, task.id]
    );

    const cancelAdd = () => {
        setOpen(false);
        setTitle("");
    };

    const linkTaskIds = async (
        sourceId: string,
        targetId: string,
        otherKey: string
    ) => {
        const kind: TaskLinkKind =
            addKind === "relates_to" ? "relates_to" : "blocks";
        const resolvedSourceId = addKind === "blocked_by" ? targetId : sourceId;
        const resolvedTargetId = addKind === "blocked_by" ? sourceId : targetId;
        await createTaskLink(resolvedSourceId, resolvedTargetId, kind);
        toast.success(t("taskLinks.added", { key: otherKey }));
        cancelAdd();
    };

    const addLink = async (target: null | Task) => {
        if (!target || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await linkTaskIds(task.id, target.id, target.key);
        } catch (error) {
            toast.error(taskLinkErrorMessage(error, t));
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitCreate = async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            cancelAdd();
            return;
        }
        if (isSubmitting) return;

        const firstColumn = columns[0];
        if (!firstColumn) {
            toast.error(t("taskLinks.createFailed"));
            return;
        }

        setIsSubmitting(true);
        try {
            const created = await createTask(firstColumn.id, trimmed, {
                sprintId: task.sprintId,
                taskType: task.type,
            });
            try {
                await linkTaskIds(task.id, created.id, created.key);
            } catch (linkError) {
                toast.error(taskLinkErrorMessage(linkError, t));
            }
        } catch {
            toast.error(t("taskLinks.createFailed"));
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

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-ui font-medium">
                    {open && addMode === "link"
                        ? t("taskLinks.linkTitle")
                        : t("taskLinks.title")}
                </h3>
                {canEdit ? (
                    open ? (
                        <Button
                            className="h-8 px-2 text-muted-foreground"
                            disabled={isSubmitting}
                            onClick={() => {
                                cancelAdd();
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            {t("taskLinks.cancel")}
                        </Button>
                    ) : (
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
                    )
                ) : undefined}
            </div>

            {canEdit && open ? (
                <div className="flex flex-col gap-2" ref={addFormReference}>
                    <Select
                        onValueChange={(value) => {
                            if (
                                value === "relates_to" ||
                                value === "blocks" ||
                                value === "blocked_by"
                            ) {
                                skipBlurClose.current = true;
                                setAddKind(value);
                            }
                        }}
                        value={addKind}
                    >
                        <SelectTrigger
                            aria-label={t("taskLinks.addKind")}
                            className="h-8 w-full font-mono text-code"
                            onPointerDown={() => {
                                skipBlurClose.current = true;
                            }}
                        >
                            <span>
                                {addKind === "blocked_by"
                                    ? t("taskLinks.blockedBy")
                                    : addKind === "blocks"
                                      ? t("taskLinks.blocks")
                                      : t("taskLinks.relatesTo")}
                            </span>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                            <SelectItem value="blocked_by">
                                {t("taskLinks.blockedBy")}
                            </SelectItem>
                            <SelectItem value="blocks">
                                {t("taskLinks.blocks")}
                            </SelectItem>
                            <SelectItem value="relates_to">
                                {t("taskLinks.relatesTo")}
                            </SelectItem>
                        </SelectContent>
                    </Select>
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
                            aria-label={t("taskLinks.addModeLabel")}
                            className="h-8 w-full font-mono text-code"
                            onPointerDown={() => {
                                skipBlurClose.current = true;
                            }}
                        >
                            <span>
                                {addMode === "create"
                                    ? t("taskLinks.addMode.create")
                                    : t("taskLinks.addMode.link")}
                            </span>
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                            <SelectItem value="create">
                                {t("taskLinks.addMode.create")}
                            </SelectItem>
                            <SelectItem value="link">
                                {t("taskLinks.addMode.link")}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    {addMode === "create" ? (
                        <Input
                            aria-label={t("taskLinks.createPlaceholder")}
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
                                    void submitCreate();
                                }
                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    skipBlurClose.current = true;
                                    cancelAdd();
                                }
                            }}
                            placeholder={t("taskLinks.createPlaceholder")}
                            ref={inputReference}
                            value={title}
                        />
                    ) : (
                        <TaskSearchPicker
                            boards={boards}
                            currentBoardId={boardId}
                            disabled={isSubmitting}
                            emptyText={t("taskLinks.noResults")}
                            items={candidates}
                            labels={labels}
                            onSelect={(target) => {
                                void addLink(target);
                            }}
                            people={people}
                            placeholder={t("taskLinks.addPlaceholder")}
                            projectId={projectId}
                        />
                    )}
                </div>
            ) : undefined}

            {peers.length === 0 && !open ? (
                <p className="text-ui text-muted-foreground">
                    {t("taskLinks.empty")}
                </p>
            ) : undefined}

            <LinkGroup
                canEdit={canEdit}
                columnsByBoardId={columnsByBoardId}
                onOpen={selectTask}
                onRemove={removeLink}
                peers={blockedBy}
                title={t("taskLinks.blockedBy")}
                tone="blockedBy"
            />
            <LinkGroup
                canEdit={canEdit}
                columnsByBoardId={columnsByBoardId}
                onOpen={selectTask}
                onRemove={removeLink}
                peers={blocks}
                title={t("taskLinks.blocks")}
                tone="blocks"
            />
            <LinkGroup
                canEdit={canEdit}
                columnsByBoardId={columnsByBoardId}
                onOpen={selectTask}
                onRemove={removeLink}
                peers={related}
                title={t("taskLinks.relatesTo")}
                tone="relates"
            />
        </section>
    );
}

const LINK_TONE: Record<
    LinkTone,
    {
        accent: string;
        header: string;
        icon: LucideIcon;
        iconClass: string;
        row: string;
    }
> = {
    blockedBy: {
        accent: "before:bg-destructive",
        header: "text-destructive",
        icon: Ban,
        iconClass: "text-destructive",
        row: "border-destructive/25 bg-destructive/5 hover:bg-destructive/10",
    },
    blocks: {
        accent: "before:bg-amber-500",
        header: "text-amber-600 dark:text-amber-400",
        icon: ArrowRight,
        iconClass: "text-amber-600 dark:text-amber-400",
        row: "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10",
    },
    relates: {
        accent: "before:bg-muted-foreground",
        header: "text-foreground",
        icon: Link2,
        iconClass: "text-muted-foreground",
        row: "border-border bg-muted/30 hover:bg-muted/60",
    },
};

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

function LinkGroup({
    canEdit,
    columnsByBoardId,
    onOpen,
    onRemove,
    peers,
    title,
    tone,
}: {
    canEdit: boolean;
    columnsByBoardId: ReadonlyMap<string, BoardColumn[]>;
    onOpen: (taskId: string) => void;
    onRemove: (linkId: string, otherKey: string) => Promise<void>;
    peers: TaskLinkPeer[];
    title: string;
    tone: LinkTone;
}) {
    const { t } = useTranslation("board");
    const style = LINK_TONE[tone];
    const Icon = style.icon;

    if (peers.length === 0) return;

    return (
        <div className="flex flex-col gap-1.5">
            <span
                className={cn(
                    "flex items-center gap-1.5 text-meta font-medium",
                    style.header
                )}
            >
                <Icon
                    aria-hidden
                    className={cn("size-3.5 shrink-0", style.iconClass)}
                />
                <span>{title}</span>
                <Badge
                    className="rounded-sm px-1.5 font-mono"
                    variant="secondary"
                >
                    {peers.length}
                </Badge>
            </span>
            <ul className="flex flex-col gap-1">
                {peers.map((peer) => (
                    <li
                        className="flex min-w-0 items-center gap-1"
                        key={peer.id}
                    >
                        <button
                            className={cn(
                                "relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-none border px-2 py-1.5 pl-3 text-left outline-none before:absolute before:inset-y-0 before:left-0 before:w-0.5 focus-visible:ring-2 focus-visible:ring-ring",
                                style.accent,
                                style.row
                            )}
                            onClick={() => {
                                onOpen(peer.otherId);
                            }}
                            type="button"
                        >
                            <Badge
                                className="max-w-24 shrink-0 truncate rounded-sm font-mono"
                                variant="outline"
                            >
                                {peer.otherKey}
                            </Badge>
                            <span className="min-w-0 truncate text-ui">
                                {peer.otherTitle}
                            </span>
                            <span
                                className="max-w-28 shrink-0 truncate text-meta text-muted-foreground"
                                title={t("fields.status")}
                            >
                                {resolveLinkPeerStatusName(
                                    columnsByBoardId,
                                    peer
                                )}
                            </span>
                        </button>
                        {canEdit ? (
                            <Button
                                aria-label={t("taskLinks.remove", {
                                    key: peer.otherKey,
                                })}
                                className="size-8 shrink-0"
                                onClick={() => {
                                    void onRemove(peer.id, peer.otherKey);
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
        </div>
    );
}

function resolveLinkPeerStatusName(
    columnsByBoardId: ReadonlyMap<string, BoardColumn[]>,
    peer: Pick<TaskLinkPeer, "otherBoardId" | "otherStatus">
): string {
    if (!peer.otherStatus) return peer.otherStatus;
    const columns = columnsByBoardId.get(peer.otherBoardId) ?? [];
    return (
        columns.find((column) => column.id === peer.otherStatus)?.name ??
        peer.otherStatus
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
    if (message === TASK_LINK_ERROR.blocks_cycle) {
        return t("taskLinks.cycleRefused");
    }
    return t("taskLinks.addFailed");
}
