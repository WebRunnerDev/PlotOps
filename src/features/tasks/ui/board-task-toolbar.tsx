import type { ReactNode } from "react";

import { Eye, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";
import type { BoardTaskFilters } from "@/features/tasks/lib/filter-tasks";
import type { BoardSortPreference } from "@/features/tasks/lib/sort-tasks-by-board-sort";

import { BoardHideCompletedControl } from "@/features/tasks/ui/board-hide-completed-control";
import { BoardSortControl } from "@/features/tasks/ui/board-sort-control";
import { BoardSubtaskVisibilityControl } from "@/features/tasks/ui/board-subtask-visibility-control";
import {
    type BoardFilterBoard,
    type BoardFilterPerson,
    BoardTaskFiltersBar,
} from "@/features/tasks/ui/board-task-filters";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/shadcn/ui/input";

type BoardTaskToolbarProperties = {
    boards?: BoardFilterBoard[];
    className?: string;
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

    return (
        <div className={cn("flex min-w-0 flex-col gap-2", className)}>
            <div className="relative w-full min-w-0 sm:max-w-sm">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    className="pl-8"
                    onChange={(event) => {
                        onSearchQueryChange(event.target.value);
                    }}
                    placeholder={t("taskSearchPlaceholder")}
                    type="search"
                    value={searchQuery}
                />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-y-2">
                <ToolbarSection>
                    <BoardTaskFiltersBar
                        boards={boards}
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
        <div className="flex min-w-0 flex-wrap items-center gap-2 not-first:sm:ml-3 not-first:sm:border-l not-first:sm:border-border not-first:sm:pl-3">
            {children}
        </div>
    );
}
