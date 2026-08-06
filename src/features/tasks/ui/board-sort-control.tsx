import {
    ArrowDownUp,
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
    BoardSortField,
    BoardSortPreference,
} from "@/features/tasks/lib/sort-tasks-by-board-sort";

import { cn } from "@/shared/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";

type BoardSortControlProperties = {
    onChange: (sort: BoardSortPreference) => void;
    value: BoardSortPreference;
};

type SortRadioValue =
    "manual" | `${BoardSortField}:asc` | `${BoardSortField}:desc`;

const FIELD_OPTIONS: BoardSortField[] = [
    "priority",
    "deadline",
    "created",
    "title",
];

export function BoardSortControl({
    onChange,
    value,
}: BoardSortControlProperties) {
    const { t } = useTranslation("board");
    const radioValue = toRadioValue(value);
    const isActive = value.field !== "manual";

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                <ArrowDownUp aria-hidden className="size-3.5" />
                {t("sort.label")}
            </span>

            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={t("sort.label")}
                    className={cn(
                        "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted",
                        isActive && "border-primary/40 bg-primary/5"
                    )}
                >
                    <span className="min-w-0 truncate">
                        {labelForValue(radioValue, t)}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                    <DropdownMenuLabel>{t("sort.label")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        onValueChange={(next) => {
                            onChange(fromRadioValue(next as SortRadioValue));
                        }}
                        value={radioValue}
                    >
                        <DropdownMenuRadioItem value="manual">
                            {t("sort.manual")}
                        </DropdownMenuRadioItem>
                        {FIELD_OPTIONS.flatMap((field) => [
                            <DropdownMenuRadioItem
                                key={`${field}:asc`}
                                value={`${field}:asc`}
                            >
                                <ArrowUpNarrowWide
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {t(`sort.${field}Asc`)}
                            </DropdownMenuRadioItem>,
                            <DropdownMenuRadioItem
                                key={`${field}:desc`}
                                value={`${field}:desc`}
                            >
                                <ArrowDownWideNarrow
                                    aria-hidden
                                    className="size-3.5"
                                />
                                {t(`sort.${field}Desc`)}
                            </DropdownMenuRadioItem>,
                        ])}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function fromRadioValue(value: SortRadioValue): BoardSortPreference {
    if (value === "manual") {
        return { field: "manual" };
    }

    const { direction, field } = parseFieldDirection(value);
    return { direction, field };
}

function labelForValue(
    value: SortRadioValue,
    t: (key: string) => string
): string {
    if (value === "manual") {
        return t("sort.manual");
    }

    const { direction, field } = parseFieldDirection(value);
    return t(direction === "asc" ? `sort.${field}Asc` : `sort.${field}Desc`);
}

function parseFieldDirection(value: Exclude<SortRadioValue, "manual">): {
    direction: "asc" | "desc";
    field: BoardSortField;
} {
    const [field, direction] = value.split(":") as [
        BoardSortField,
        "asc" | "desc",
    ];
    return { direction, field };
}

function toRadioValue(sort: BoardSortPreference): SortRadioValue {
    if (sort.field === "manual") return "manual";
    return `${sort.field}:${sort.direction}`;
}
