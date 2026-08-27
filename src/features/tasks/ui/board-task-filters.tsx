import type { ReactNode } from "react";

import {
    Calendar,
    CircleCheck,
    Flag,
    LayoutGrid,
    ListFilter,
    Tag,
    User,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { getLabelDotProperties, type ProjectLabel } from "@/features/labels";
import {
    type BoardTaskFilters,
    DEADLINE_FILTER_VALUES,
    EMPTY_BOARD_FILTERS,
    isBoardFiltersActive,
    type PriorityFilterValue,
    toggleFilterValue,
    UNASSIGNED_ASSIGNEE_FILTER,
} from "@/features/tasks/lib/filter-tasks";
import { TASK_PRIORITIES } from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";

export type BoardFilterBoard = {
    id: string;
    name: string;
};

export type BoardFilterPerson = {
    avatarUrl?: string;
    id: string;
    name: string;
};

type BoardTaskFiltersBarProperties = {
    /** When set and length > 1, show a Board facet (project-wide pickers). */
    boards?: BoardFilterBoard[];
    /** Hide the “Filter” legend — use in compact pickers. */
    compact?: boolean;
    filters: BoardTaskFilters;
    /** When set, show a toggle to hide Tasks in Done columns. */
    hideCompleted?: boolean;
    labels: ProjectLabel[];
    /**
     * Nested pickers set `false` so a facet menu does not steal the
     * Combobox popup (dropdown portals outside the searcher).
     */
    menuModal?: boolean;
    onChange: (filters: BoardTaskFilters) => void;
    onHideCompletedChange?: (hideCompleted: boolean) => void;
    people: BoardFilterPerson[];
};

const PRIORITY_FILTER_VALUES: PriorityFilterValue[] = [
    ...TASK_PRIORITIES,
    "none",
];

export function BoardTaskFiltersBar({
    boards,
    compact = false,
    filters,
    hideCompleted = false,
    labels,
    menuModal = true,
    onChange,
    onHideCompletedChange,
    people,
}: BoardTaskFiltersBarProperties) {
    const { t } = useTranslation("board");
    const active = isBoardFiltersActive(filters);
    const showBoardFilter = (boards?.length ?? 0) > 1;

    const assigneeOptions = [
        UNASSIGNED_ASSIGNEE_FILTER,
        ...people.map((person) => person.id),
    ];
    const boardOptions = boards?.map((board) => board.id) ?? [];
    const labelOptions = labels.map((label) => label.id);

    const clearFilters = () => {
        onChange(EMPTY_BOARD_FILTERS);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {compact ? undefined : (
                <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                    <ListFilter aria-hidden className="size-3.5" />
                    {t("filters.label")}
                </span>
            )}

            {showBoardFilter && boards ? (
                <FilterMenu
                    activeCount={filters.boardIds.length}
                    icon={<LayoutGrid className="size-3.5" />}
                    label={t("fields.board")}
                    modal={menuModal}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            {t("fields.board")}
                        </DropdownMenuLabel>
                        <SelectAllCheckboxItem
                            allValues={boardOptions}
                            onChange={(next) => {
                                onChange({
                                    ...filters,
                                    boardIds: next,
                                });
                            }}
                            selected={filters.boardIds}
                        />
                        <DropdownMenuSeparator />
                        {boards.map((board) => (
                            <DropdownMenuCheckboxItem
                                checked={filters.boardIds.includes(board.id)}
                                key={board.id}
                                onCheckedChange={() => {
                                    onChange({
                                        ...filters,
                                        boardIds: toggleFilterValue(
                                            filters.boardIds,
                                            board.id
                                        ),
                                    });
                                }}
                            >
                                {board.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                </FilterMenu>
            ) : undefined}

            <FilterMenu
                activeCount={filters.priorities.length}
                icon={<Flag className="size-3.5" />}
                label={t("fields.priority")}
                modal={menuModal}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>
                        {t("fields.priority")}
                    </DropdownMenuLabel>
                    <SelectAllCheckboxItem
                        allValues={PRIORITY_FILTER_VALUES}
                        onChange={(next) => {
                            onChange({ ...filters, priorities: next });
                        }}
                        selected={filters.priorities}
                    />
                    <DropdownMenuSeparator />
                    {PRIORITY_FILTER_VALUES.map((priority) => (
                        <DropdownMenuCheckboxItem
                            checked={filters.priorities.includes(priority)}
                            key={priority}
                            onCheckedChange={() => {
                                onChange({
                                    ...filters,
                                    priorities: toggleFilterValue(
                                        filters.priorities,
                                        priority
                                    ),
                                });
                            }}
                        >
                            {t(`priority.${priority}`)}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </FilterMenu>

            <FilterMenu
                activeCount={filters.assigneeIds.length}
                icon={<User className="size-3.5" />}
                label={t("fields.assignee")}
                modal={menuModal}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>
                        {t("fields.assignee")}
                    </DropdownMenuLabel>
                    <SelectAllCheckboxItem
                        allValues={assigneeOptions}
                        onChange={(next) => {
                            onChange({ ...filters, assigneeIds: next });
                        }}
                        selected={filters.assigneeIds}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        checked={filters.assigneeIds.includes(
                            UNASSIGNED_ASSIGNEE_FILTER
                        )}
                        onCheckedChange={() => {
                            onChange({
                                ...filters,
                                assigneeIds: toggleFilterValue(
                                    filters.assigneeIds,
                                    UNASSIGNED_ASSIGNEE_FILTER
                                ),
                            });
                        }}
                    >
                        {t("fields.memberNone")}
                    </DropdownMenuCheckboxItem>
                    {people.length === 0 ? (
                        <p className="px-1.5 py-2 text-sm text-muted-foreground">
                            {t("filters.assigneesEmpty")}
                        </p>
                    ) : (
                        people.map((person) => (
                            <DropdownMenuCheckboxItem
                                checked={filters.assigneeIds.includes(
                                    person.id
                                )}
                                key={person.id}
                                onCheckedChange={() => {
                                    onChange({
                                        ...filters,
                                        assigneeIds: toggleFilterValue(
                                            filters.assigneeIds,
                                            person.id
                                        ),
                                    });
                                }}
                            >
                                {person.name}
                            </DropdownMenuCheckboxItem>
                        ))
                    )}
                </DropdownMenuGroup>
            </FilterMenu>

            <FilterMenu
                activeCount={filters.deadlines.length}
                icon={<Calendar className="size-3.5" />}
                label={t("fields.deadline")}
                modal={menuModal}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>
                        {t("fields.deadline")}
                    </DropdownMenuLabel>
                    <SelectAllCheckboxItem
                        allValues={DEADLINE_FILTER_VALUES}
                        onChange={(next) => {
                            onChange({ ...filters, deadlines: next });
                        }}
                        selected={filters.deadlines}
                    />
                    <DropdownMenuSeparator />
                    {DEADLINE_FILTER_VALUES.map((deadline) => (
                        <DropdownMenuCheckboxItem
                            checked={filters.deadlines.includes(deadline)}
                            key={deadline}
                            onCheckedChange={() => {
                                onChange({
                                    ...filters,
                                    deadlines: toggleFilterValue(
                                        filters.deadlines,
                                        deadline
                                    ),
                                });
                            }}
                        >
                            {t(`filters.deadline.${deadline}`)}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>
            </FilterMenu>

            <FilterMenu
                activeCount={filters.labelIds.length}
                disabled={labels.length === 0}
                icon={<Tag className="size-3.5" />}
                label={t("fields.labels")}
                modal={menuModal}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("fields.labels")}</DropdownMenuLabel>
                    {labels.length === 0 ? (
                        <p className="px-1.5 py-2 text-sm text-muted-foreground">
                            {t("filters.labelsEmpty")}
                        </p>
                    ) : (
                        <>
                            <SelectAllCheckboxItem
                                allValues={labelOptions}
                                onChange={(next) => {
                                    onChange({ ...filters, labelIds: next });
                                }}
                                selected={filters.labelIds}
                            />
                            <DropdownMenuSeparator />
                            {labels.map((label) => {
                                const dot = getLabelDotProperties(label);
                                return (
                                    <DropdownMenuCheckboxItem
                                        checked={filters.labelIds.includes(
                                            label.id
                                        )}
                                        key={label.id}
                                        onCheckedChange={() => {
                                            onChange({
                                                ...filters,
                                                labelIds: toggleFilterValue(
                                                    filters.labelIds,
                                                    label.id
                                                ),
                                            });
                                        }}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "size-2 shrink-0 rounded-full",
                                                dot.className
                                            )}
                                            style={dot.style}
                                        />
                                        {label.name}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </>
                    )}
                </DropdownMenuGroup>
            </FilterMenu>

            {onHideCompletedChange ? (
                <Button
                    aria-label={t("filters.hideCompleted")}
                    aria-pressed={hideCompleted}
                    className={cn(
                        "h-7 max-w-full gap-1.5 px-2.5 text-[0.8rem]",
                        hideCompleted && "border-primary/40 bg-primary/5"
                    )}
                    onClick={() => {
                        onHideCompletedChange(!hideCompleted);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <CircleCheck aria-hidden className="size-3.5" />
                    <span className="min-w-0 truncate">
                        {hideCompleted
                            ? t("filters.showCompleted")
                            : t("filters.hideCompleted")}
                    </span>
                </Button>
            ) : undefined}

            {active ? (
                <Button
                    onClick={clearFilters}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <X data-icon="inline-start" />
                    {t("filters.clear")}
                </Button>
            ) : undefined}
        </div>
    );
}

function FilterMenu({
    activeCount,
    children,
    disabled = false,
    icon,
    label,
    modal = true,
}: {
    activeCount: number;
    children: ReactNode;
    disabled?: boolean;
    icon: ReactNode;
    label: string;
    modal?: boolean;
}) {
    return (
        <DropdownMenu modal={modal}>
            <DropdownMenuTrigger
                className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-expanded:bg-muted",
                    activeCount > 0 && "border-primary/40 bg-primary/5"
                )}
                disabled={disabled}
            >
                {icon}
                {label}
                {activeCount > 0 ? (
                    <Badge
                        className="h-4 min-w-4 rounded-sm px-1 font-mono text-[0.625rem]"
                        variant="secondary"
                    >
                        {activeCount}
                    </Badge>
                ) : undefined}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function SelectAllCheckboxItem<T extends string>({
    allValues,
    onChange,
    selected,
}: {
    allValues: readonly T[];
    onChange: (next: T[]) => void;
    selected: readonly T[];
}) {
    const { t } = useTranslation("board");
    if (allValues.length === 0) return null;

    const allSelected = allValues.every((value) => selected.includes(value));

    return (
        <DropdownMenuCheckboxItem
            checked={allSelected}
            onCheckedChange={(checked) => {
                onChange(checked ? [...allValues] : []);
            }}
        >
            {allSelected ? t("filters.deselectAll") : t("filters.selectAll")}
        </DropdownMenuCheckboxItem>
    );
}
