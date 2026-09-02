import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { BoardColumn } from "@/features/boards";
import type { ProjectLabel } from "@/features/labels";
import type { Task } from "@/features/tasks/model/types";

import { resolveBoardsProvider } from "@/features/boards/api/resolve-boards-provider";
import { boardKeys } from "@/features/boards/model/query-keys";
import { isGuest } from "@/features/guest-mode";
import {
    doneColumnIdSet,
    hideCompletedBoardTasks,
} from "@/features/tasks/lib/board-completed-visibility";
import {
    type BoardTaskFilters,
    EMPTY_BOARD_FILTERS,
    filterTasks,
} from "@/features/tasks/lib/filter-tasks";
import { matchesTaskSearchQuery } from "@/features/tasks/lib/search-tasks";
import {
    type BoardFilterBoard,
    type BoardFilterPerson,
    BoardTaskFiltersBar,
} from "@/features/tasks/ui/board-task-filters";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";

type TaskSearchPickerProperties = {
    boards?: BoardFilterBoard[];
    currentBoardId?: string;
    disabled?: boolean;
    emptyText: string;
    items: Task[];
    labels: ProjectLabel[];
    onSelect: (task: Task) => void;
    people: BoardFilterPerson[];
    placeholder: string;
    projectId: string;
};

/** Project-wide Task combobox with Board facet filters inside the popup. */
export function TaskSearchPicker({
    boards = [],
    currentBoardId,
    disabled = false,
    emptyText,
    items,
    labels,
    onSelect,
    people,
    placeholder,
    projectId,
}: TaskSearchPickerProperties) {
    const { t } = useTranslation("board");
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);
    const [hideCompleted, setHideCompleted] = useState(false);
    const emptySelection: null | Task = null;
    const boardsProvider = resolveBoardsProvider(isGuest());
    const columnQueries = useQueries({
        queries: boards.map((board) => ({
            enabled: Boolean(projectId && board.id),
            queryFn: () =>
                boardsProvider.fetchBoardColumns(projectId, board.id),
            queryKey: boardKeys.columns(projectId, board.id),
        })),
    });

    const boardNameById = useMemo(
        () => new Map(boards.map((board) => [board.id, board.name])),
        [boards]
    );

    const columnsByBoardId = useMemo(() => {
        const map = new Map<string, BoardColumn[]>();
        for (const [index, board] of boards.entries()) {
            map.set(board.id, columnQueries[index]?.data ?? []);
        }
        return map;
    }, [boards, columnQueries]);

    const doneColumnIds = useMemo(() => {
        const ids = new Set<string>();
        for (const columns of columnsByBoardId.values()) {
            for (const columnId of doneColumnIdSet(columns)) {
                ids.add(columnId);
            }
        }
        return ids;
    }, [columnsByBoardId]);

    const filteredItems = useMemo(() => {
        const facetFiltered = filterTasks(items, filters);
        return hideCompletedBoardTasks(
            facetFiltered,
            doneColumnIds,
            hideCompleted
        );
    }, [doneColumnIds, filters, hideCompleted, items]);

    return (
        <Combobox
            disabled={disabled}
            filter={(item, query) => {
                if (!item) return false;
                const boardName = boardNameById.get(item.boardId) ?? "";
                return matchesTaskSearchQuery(item, query, [boardName]);
            }}
            isItemEqualToValue={(left: null | Task, right: null | Task) =>
                left?.id === right?.id
            }
            items={filteredItems}
            itemToStringLabel={(item: null | Task) => {
                if (!item) return "";
                const boardName = boardNameById.get(item.boardId) ?? "";
                return boardName
                    ? `${item.key} ${item.title} ${boardName}`
                    : `${item.key} ${item.title}`;
            }}
            onOpenChange={(open, details) => {
                if (!open && isFilterMenuInteraction(details)) {
                    details.cancel();
                }
            }}
            onValueChange={(value: null | Task) => {
                if (value) onSelect(value);
            }}
            value={emptySelection}
        >
            <ComboboxInput
                aria-label={placeholder}
                className="h-8 w-full font-mono text-code"
                placeholder={placeholder}
            />
            <ComboboxContent>
                <div
                    className="flex shrink-0 border-b border-border px-2 py-1.5"
                    onMouseDown={(event) => {
                        event.preventDefault();
                    }}
                >
                    <BoardTaskFiltersBar
                        boards={boards}
                        compact
                        filters={filters}
                        hideCompleted={hideCompleted}
                        labels={labels}
                        menuModal={false}
                        onChange={setFilters}
                        onHideCompletedChange={setHideCompleted}
                        people={people}
                    />
                </div>
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                <ComboboxList>
                    {(item: Task) => {
                        const statusName = resolveTaskStatusName(
                            columnsByBoardId,
                            item
                        );
                        const showOtherBoard =
                            currentBoardId != undefined &&
                            item.boardId !== currentBoardId;

                        return (
                            <ComboboxItem key={item.id} value={item}>
                                <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                    {item.key}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                    {item.title}
                                </span>
                                <div className="ml-auto flex shrink-0 items-center gap-2">
                                    <span
                                        className="max-w-28 truncate text-meta text-muted-foreground"
                                        title={t("fields.status")}
                                    >
                                        {statusName}
                                    </span>
                                    {showOtherBoard ? (
                                        <span className="max-w-24 truncate font-mono text-meta text-muted-foreground">
                                            {boardNameById.get(item.boardId) ??
                                                t("taskLinks.otherBoard")}
                                        </span>
                                    ) : undefined}
                                </div>
                            </ComboboxItem>
                        );
                    }}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function isFilterMenuInteraction(details: {
    event: Event;
    reason: string;
}): boolean {
    if (details.reason === "escape-key" || details.reason === "item-press") {
        return false;
    }

    const nodes: Array<EventTarget | null> = [details.event.target];
    if (details.event instanceof FocusEvent) {
        nodes.push(details.event.relatedTarget);
    }

    return nodes.some((node) => {
        if (!(node instanceof Element)) return false;
        return Boolean(
            node.closest("[data-slot=dropdown-menu-content]") ||
            node.closest("[data-slot=dropdown-menu-trigger]")
        );
    });
}

function resolveTaskStatusName(
    columnsByBoardId: ReadonlyMap<string, BoardColumn[]>,
    task: Pick<Task, "boardId" | "status">
): string {
    const columns = columnsByBoardId.get(task.boardId) ?? [];
    return (
        columns.find((column) => column.id === task.status)?.name ?? task.status
    );
}
