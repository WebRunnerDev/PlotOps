import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";
import type { Task } from "@/features/tasks/model/types";

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
}: TaskSearchPickerProperties) {
    const { t } = useTranslation("board");
    const [filters, setFilters] =
        useState<BoardTaskFilters>(EMPTY_BOARD_FILTERS);
    const emptySelection: null | Task = null;

    const boardNameById = useMemo(
        () => new Map(boards.map((board) => [board.id, board.name])),
        [boards]
    );

    const filteredItems = useMemo(
        () => filterTasks(items, filters),
        [filters, items]
    );

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
                        labels={labels}
                        menuModal={false}
                        onChange={setFilters}
                        people={people}
                    />
                </div>
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                <ComboboxList>
                    {(item: Task) => (
                        <ComboboxItem key={item.id} value={item}>
                            <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                {item.key}
                            </span>
                            <span className="min-w-0 truncate">
                                {item.title}
                            </span>
                            {currentBoardId &&
                            item.boardId !== currentBoardId ? (
                                <span className="ml-auto shrink-0 font-mono text-meta text-muted-foreground">
                                    {boardNameById.get(item.boardId) ??
                                        t("taskLinks.otherBoard")}
                                </span>
                            ) : undefined}
                        </ComboboxItem>
                    )}
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
