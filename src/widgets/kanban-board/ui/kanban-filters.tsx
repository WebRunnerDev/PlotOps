import type { ReactNode } from "react";

import { Calendar, Flag, ListFilter, Tag, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    type BoardTaskFilters,
    DEADLINE_FILTER_VALUES,
    getLabelDotProps,
    isBoardFiltersActive,
    type PriorityFilterValue,
    type ProjectLabel,
    TASK_PRIORITIES,
    toggleFilterValue,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";

type KanbanFiltersProperties = {
    filters: BoardTaskFilters;
    labels: ProjectLabel[];
    onChange: (filters: BoardTaskFilters) => void;
};

const PRIORITY_FILTER_VALUES: PriorityFilterValue[] = [
    ...TASK_PRIORITIES,
    "none",
];

export function KanbanFilters({
    filters,
    labels,
    onChange,
}: KanbanFiltersProperties) {
    const { t } = useTranslation("board");
    const active = isBoardFiltersActive(filters);

    const clearFilters = () => {
        onChange({
            deadlines: [],
            labelIds: [],
            priorities: [],
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                <ListFilter aria-hidden className="size-3.5" />
                {t("filters.label")}
            </span>

            <FilterMenu
                activeCount={filters.priorities.length}
                icon={<Flag className="size-3.5" />}
                label={t("fields.priority")}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("fields.priority")}</DropdownMenuLabel>
                    {PRIORITY_FILTER_VALUES.map((priority) => (
                        <DropdownMenuCheckboxItem
                            checked={filters.priorities.includes(priority)}
                            key={priority}
                            onCheckedChange={() => {
                                onChange({
                                    ...filters,
                                    priorities: toggleFilterValue(
                                        filters.priorities,
                                        priority,
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
                activeCount={filters.deadlines.length}
                icon={<Calendar className="size-3.5" />}
                label={t("fields.deadline")}
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("fields.deadline")}</DropdownMenuLabel>
                    {DEADLINE_FILTER_VALUES.map((deadline) => (
                        <DropdownMenuCheckboxItem
                            checked={filters.deadlines.includes(deadline)}
                            key={deadline}
                            onCheckedChange={() => {
                                onChange({
                                    ...filters,
                                    deadlines: toggleFilterValue(
                                        filters.deadlines,
                                        deadline,
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
            >
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("fields.labels")}</DropdownMenuLabel>
                    {labels.length === 0 ? (
                        <p className="px-1.5 py-2 text-sm text-muted-foreground">
                            {t("filters.labelsEmpty")}
                        </p>
                    ) : (
                        labels.map((label) => {
                            const dot = getLabelDotProps(label);
                            return (
                                <DropdownMenuCheckboxItem
                                    checked={filters.labelIds.includes(
                                        label.id,
                                    )}
                                    key={label.id}
                                    onCheckedChange={() => {
                                        onChange({
                                            ...filters,
                                            labelIds: toggleFilterValue(
                                                filters.labelIds,
                                                label.id,
                                            ),
                                        });
                                    }}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "size-2 shrink-0 rounded-full",
                                            dot.className,
                                        )}
                                        style={dot.style}
                                    />
                                    {label.name}
                                </DropdownMenuCheckboxItem>
                            );
                        })
                    )}
                </DropdownMenuGroup>
            </FilterMenu>

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
}: {
    activeCount: number;
    children: ReactNode;
    disabled?: boolean;
    icon: ReactNode;
    label: string;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-expanded:bg-muted",
                    activeCount > 0 && "border-primary/40 bg-primary/5",
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
