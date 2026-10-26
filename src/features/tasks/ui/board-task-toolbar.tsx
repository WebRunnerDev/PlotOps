import { Eye, Search, SlidersHorizontal } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";
import type { BoardSortPreference } from "@/features/tasks/lib/sort-tasks-by-board-sort";

import {
    type BoardTaskFilters,
    countActiveBoardFilterFacets,
} from "@/features/tasks/lib/filter-tasks";
import { BoardHideCompletedControl } from "@/features/tasks/ui/board-hide-completed-control";
import { BoardSortControl } from "@/features/tasks/ui/board-sort-control";
import { BoardSubtaskVisibilityControl } from "@/features/tasks/ui/board-subtask-visibility-control";
import {
    type BoardFilterBoard,
    type BoardFilterEpic,
    type BoardFilterPerson,
    BoardTaskFiltersBar,
} from "@/features/tasks/ui/board-task-filters";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";

type BoardTaskToolbarProperties = {
    boards?: BoardFilterBoard[];
    className?: string;
    epics?: BoardFilterEpic[];
    filters: BoardTaskFilters;
    hideCompleted?: boolean;
    hideSubtasks?: boolean;
    labels: ProjectLabel[];
    onChange: (filters: BoardTaskFilters) => void;
    onHideCompletedChange?: (hideCompleted: boolean) => void;
    onHideSubtasksChange?: (hideSubtasks: boolean) => void;
    onSearchQueryChange: (query: string) => void;
    onSortChange: (sort: BoardSortPreference) => void;
    people: BoardFilterPerson[];
    searchQuery: string;
    showSubtaskVisibility?: boolean;
    sort: BoardSortPreference;
};

/** Search + facet filters + sort (+ optional subtask toggle) for Board and Backlog. */
export function BoardTaskToolbar({
    boards,
    className,
    epics,
    filters,
    hideCompleted = false,
    hideSubtasks = false,
    labels,
    onChange,
    onHideCompletedChange,
    onHideSubtasksChange,
    onSearchQueryChange,
    onSortChange,
    people,
    searchQuery,
    showSubtaskVisibility = false,
    sort,
}: BoardTaskToolbarProperties) {
    const { t } = useTranslation("board");
    const showViewSection =
        onHideCompletedChange !== undefined ||
        (showSubtaskVisibility && onHideSubtasksChange !== undefined);
    // Mobile: controls collapse behind one toggle so the board keeps its height.
    const [controlsOpen, setControlsOpen] = useState(false);
    const controlsId = useId();
    const activeCount =
        countActiveBoardFilterFacets(filters) +
        (sort.field === "manual" ? 0 : 1) +
        (onHideCompletedChange && hideCompleted ? 1 : 0) +
        (showSubtaskVisibility && onHideSubtasksChange && hideSubtasks ? 1 : 0);

    return (
        <div className={cn("flex min-w-0 flex-col gap-2", className)}>
            <div className="flex min-w-0 items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-sm">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        className="rounded-none border-primary/25 bg-input/30 pl-8 font-mono text-code shadow-none focus-visible:border-primary/50"
                        onChange={(event) => {
                            onSearchQueryChange(event.target.value);
                        }}
                        placeholder={t("taskSearchPlaceholder")}
                        type="search"
                        value={searchQuery}
                    />
                </div>
                <Button
                    aria-controls={controlsId}
                    aria-expanded={controlsOpen}
                    className={cn(
                        "h-8 shrink-0 gap-1.5 rounded-none px-2.5 sm:hidden",
                        activeCount > 0 && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => {
                        setControlsOpen((open) => !open);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <SlidersHorizontal aria-hidden className="size-3.5" />
                    {t("filters.toggle")}
                    {activeCount > 0 ? (
                        <Badge
                            className="h-4 min-w-4 rounded-sm px-1 font-mono text-[0.625rem]"
                            variant="secondary"
                        >
                            {activeCount}
                        </Badge>
                    ) : undefined}
                </Button>
            </div>
            <div
                className={cn(
                    "min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:flex sm:gap-x-0",
                    controlsOpen ? "flex" : "hidden"
                )}
                id={controlsId}
            >
                <ToolbarSection>
                    <BoardTaskFiltersBar
                        boards={boards}
                        epics={epics}
                        filters={filters}
                        labels={labels}
                        onChange={onChange}
                        people={people}
                        showHideCompletedToggle={false}
                    />
                </ToolbarSection>
                <ToolbarSection>
                    <BoardSortControl onChange={onSortChange} value={sort} />
                </ToolbarSection>
                {showViewSection ? (
                    <ToolbarSection>
                        <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                            <Eye aria-hidden className="size-3.5" />
                            {t("view.label")}
                        </span>
                        {onHideCompletedChange ? (
                            <BoardHideCompletedControl
                                hideCompleted={hideCompleted}
                                onChange={onHideCompletedChange}
                            />
                        ) : undefined}
                        {showSubtaskVisibility && onHideSubtasksChange ? (
                            <BoardSubtaskVisibilityControl
                                hideSubtasks={hideSubtasks}
                                onChange={onHideSubtasksChange}
                            />
                        ) : null}
                    </ToolbarSection>
                ) : null}
            </div>
        </div>
    );
}

function ToolbarSection({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 not-first:sm:ml-3 not-first:sm:border-l not-first:sm:border-primary/20 not-first:sm:pl-3">
            {children}
        </div>
    );
}
