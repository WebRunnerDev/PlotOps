import { useDroppable } from "@dnd-kit/core";
import { ArrowUpRight, ChevronDown, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { EpicColor, ProjectEpic } from "@/features/tasks";

import { epicDropId } from "@/features/sprints/ui/sprint-task-table";
import {
    EPIC_COLOR_SWATCH_CLASS,
    EPIC_COLORS,
    EpicColorDot,
    TASK_TITLE_MAX_LENGTH,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type BacklogEpicsPanelProperties = {
    /** Board has a first column to create the Epic in. */
    canCreate: boolean;
    canManage: boolean;
    epics: ProjectEpic[];
    onCreateEpic: (title: string, color: EpicColor) => Promise<void>;
    onOpenEpic: (epicId: string) => void;
    onToggleEpicFilter: (epicId: string) => void;
    selectedEpicIds: readonly string[];
};

/**
 * Jira-like Epics panel: Project Epics with rollup progress. Click filters the
 * Backlog by Epic, the arrow opens the Epic, dropping Tasks on a row adds them.
 */
export function BacklogEpicsPanel({
    canCreate,
    canManage,
    epics,
    onCreateEpic,
    onOpenEpic,
    onToggleEpicFilter,
    selectedEpicIds,
}: BacklogEpicsPanelProperties) {
    const { t } = useTranslation("board");
    const [open, setOpen] = useState(true);
    const [title, setTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const liveEpics = epics.filter((epic) => epic.archivedAt === undefined);
    // Rotate through the palette so new Epics are told apart at a glance.
    const nextColor = EPIC_COLORS[liveEpics.length % EPIC_COLORS.length]!;

    const handleCreate = async () => {
        const trimmed = title.trim();
        if (!trimmed || isCreating) return;
        setIsCreating(true);
        try {
            await onCreateEpic(trimmed, nextColor);
            setTitle("");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <section
            aria-labelledby="backlog-epics-heading"
            className="relative overflow-hidden rounded-none border border-border bg-card/50 before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-violet-500/70 before:content-['']"
        >
            <header className="flex min-w-0 items-center justify-between gap-3 border-b border-border/80 px-3 py-3 sm:px-4">
                <button
                    aria-expanded={open}
                    className="group flex min-w-0 items-center gap-2 text-left transition-colors duration-300 ease-(--ease-out-expo) hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setOpen((value) => !value)}
                    type="button"
                >
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-(--ease-out-expo) group-hover:text-primary",
                            open ? "" : "-rotate-90"
                        )}
                    />
                    <Zap
                        aria-hidden
                        className="size-4 shrink-0 text-violet-500"
                    />
                    <h2 className="text-h3" id="backlog-epics-heading">
                        {t("epics.title")}
                    </h2>
                    <span className="text-meta text-muted-foreground">
                        ({liveEpics.length})
                    </span>
                </button>
                {open && liveEpics.length > 0 ? (
                    <p className="hidden text-meta text-muted-foreground sm:block">
                        {canManage
                            ? t("epics.panelHintManage")
                            : t("epics.panelHint")}
                    </p>
                ) : null}
            </header>

            {open ? (
                <>
                    {liveEpics.length === 0 ? (
                        <p className="px-4 py-6 text-ui text-muted-foreground">
                            {canManage
                                ? t("epics.emptyManage")
                                : t("epics.empty")}
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {liveEpics.map((epic) => (
                                <EpicRow
                                    canManage={canManage}
                                    epic={epic}
                                    key={epic.id}
                                    onOpen={() => onOpenEpic(epic.id)}
                                    onToggleFilter={() =>
                                        onToggleEpicFilter(epic.id)
                                    }
                                    selected={selectedEpicIds.includes(epic.id)}
                                />
                            ))}
                        </ul>
                    )}

                    {canManage && canCreate ? (
                        <form
                            className="flex min-w-0 items-center gap-2 border-t border-border/80 px-3 py-2 sm:px-4"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleCreate();
                            }}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "size-2.5 shrink-0 rounded-full",
                                    EPIC_COLOR_SWATCH_CLASS[nextColor]
                                )}
                            />
                            <Input
                                aria-label={t("epics.createPlaceholder")}
                                className="h-8 min-w-0 flex-1 rounded-none border-transparent bg-transparent font-mono text-code shadow-none focus-visible:border-primary/50"
                                disabled={isCreating}
                                maxLength={TASK_TITLE_MAX_LENGTH}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder={t("epics.createPlaceholder")}
                                value={title}
                            />
                            <Button
                                className="rounded-none"
                                disabled={isCreating || !title.trim()}
                                size="sm"
                                type="submit"
                                variant="ghost"
                            >
                                <Plus data-icon="inline-start" />
                                {t("epics.create")}
                            </Button>
                        </form>
                    ) : null}
                </>
            ) : null}
        </section>
    );
}

function EpicRow({
    canManage,
    epic,
    onOpen,
    onToggleFilter,
    selected,
}: {
    canManage: boolean;
    epic: ProjectEpic;
    onOpen: () => void;
    onToggleFilter: () => void;
    selected: boolean;
}) {
    const { t } = useTranslation("board");
    const { isOver, setNodeRef } = useDroppable({
        disabled: !canManage,
        id: epicDropId(epic.id),
    });
    const percent =
        epic.taskCount === 0
            ? 0
            : Math.round((epic.doneCount / epic.taskCount) * 100);

    return (
        <li
            className={cn(
                "group/epic flex min-w-0 items-center gap-3 px-3 py-2.5 transition-[background-color,box-shadow] duration-300 ease-(--ease-out-expo) sm:px-4",
                selected && "bg-primary/8",
                isOver &&
                    "bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_40%,transparent)]"
            )}
            ref={setNodeRef}
        >
            <button
                aria-pressed={selected}
                className="flex min-w-0 flex-1 flex-col gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onToggleFilter}
                title={t("epics.filterByEpic", { title: epic.title })}
                type="button"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <EpicColorDot color={epic.color} />
                    <span
                        className={cn(
                            "min-w-0 truncate text-ui font-medium",
                            epic.isDone && "text-muted-foreground line-through"
                        )}
                    >
                        {epic.title}
                    </span>
                    <span className="shrink-0 text-code text-muted-foreground">
                        {epic.key}
                    </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                    <span
                        aria-label={t("epics.progress", {
                            done: epic.doneCount,
                            total: epic.taskCount,
                        })}
                        className="relative h-1.5 w-full max-w-56 overflow-hidden bg-muted"
                        role="img"
                    >
                        <span
                            className={cn(
                                "absolute inset-y-0 left-0 transition-[width] duration-500 ease-(--ease-out-expo)",
                                EPIC_COLOR_SWATCH_CLASS[epic.color ?? "purple"]
                            )}
                            style={{ width: `${percent}%` }}
                        />
                    </span>
                    <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                        {t("epics.progress", {
                            done: epic.doneCount,
                            total: epic.taskCount,
                        })}
                        {epic.pointsTotal > 0
                            ? ` · ${t("epics.points", {
                                  done: epic.pointsDone,
                                  total: epic.pointsTotal,
                              })}`
                            : ""}
                    </span>
                </span>
            </button>
            <Button
                aria-label={t("epics.open", { key: epic.key })}
                className="shrink-0 rounded-none"
                onClick={onOpen}
                size="icon-sm"
                type="button"
                variant="ghost"
            >
                <ArrowUpRight />
            </Button>
        </li>
    );
}
