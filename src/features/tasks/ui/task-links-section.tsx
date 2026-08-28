import type { LucideIcon } from "lucide-react";

import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Ban, Link2, Plus, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    Task,
    TaskLinkKind,
    TaskLinkPeer,
} from "@/features/tasks/model/types";

import { useProjectBoards } from "@/features/boards";
import { isGuest } from "@/features/guest-mode";
import { useProjectLabels } from "@/features/labels";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { resolveTasksProvider } from "@/features/tasks/api/resolve-tasks-provider";
import {
    collectTaskLinkCandidates,
    mergeTaskCatalogs,
} from "@/features/tasks/lib/collect-task-link-candidates";
import { TASK_LINK_ERROR } from "@/features/tasks/lib/task-structure";
import { taskKeys } from "@/features/tasks/model/query-keys";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { TaskSearchPicker } from "@/features/tasks/ui/task-search-picker";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

type AddKind = "blocked_by" | "blocks" | "relates_to";

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
    const { createTaskLink, deleteTaskLink } = useBoardTasks(
        projectId,
        boardId
    );
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
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const [open, setOpen] = useState(false);
    const [addKind, setAddKind] = useState<AddKind>("relates_to");
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const addLink = async (target: null | Task) => {
        if (!target || isSubmitting) return;
        setIsSubmitting(true);
        const kind: TaskLinkKind =
            addKind === "relates_to" ? "relates_to" : "blocks";
        const sourceId = addKind === "blocked_by" ? target.id : task.id;
        const targetId = addKind === "blocked_by" ? task.id : target.id;
        try {
            await createTaskLink(sourceId, targetId, kind);
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

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-ui font-medium">{t("taskLinks.title")}</h3>
                {canEdit ? (
                    open ? (
                        <Button
                            className="h-8 px-2 text-muted-foreground"
                            disabled={isSubmitting}
                            onClick={() => {
                                setOpen(false);
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
                <div className="flex flex-col gap-2">
                    <Select
                        onValueChange={(value) => {
                            if (
                                value === "relates_to" ||
                                value === "blocks" ||
                                value === "blocked_by"
                            ) {
                                setAddKind(value);
                            }
                        }}
                        value={addKind}
                    >
                        <SelectTrigger
                            aria-label={t("taskLinks.addKind")}
                            className="h-8 w-full font-mono text-code"
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
                    />
                </div>
            ) : undefined}

            {peers.length === 0 && !open ? (
                <p className="text-ui text-muted-foreground">
                    {t("taskLinks.empty")}
                </p>
            ) : undefined}

            <LinkGroup
                canEdit={canEdit}
                onOpen={selectTask}
                onRemove={removeLink}
                peers={blockedBy}
                title={t("taskLinks.blockedBy")}
                tone="blockedBy"
            />
            <LinkGroup
                canEdit={canEdit}
                onOpen={selectTask}
                onRemove={removeLink}
                peers={blocks}
                title={t("taskLinks.blocks")}
                tone="blocks"
            />
            <LinkGroup
                canEdit={canEdit}
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

function LinkGroup({
    canEdit,
    onOpen,
    onRemove,
    peers,
    title,
    tone,
}: {
    canEdit: boolean;
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
