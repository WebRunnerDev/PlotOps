import { Bug, Flag, Lightbulb, SquareCheck, Tag, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { QuickAddFields } from "@/features/tasks/lib/resolve-quick-add-defaults";

import { getLabelDotProperties } from "@/features/labels/model/constants";
import { useProjectLabels } from "@/features/labels/model/use-project-labels";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import {
    PRIORITY_CLASS,
    TASK_PRIORITIES,
    TASK_TYPE_ICON_CLASS,
    TASK_TYPES,
} from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/shadcn/ui/popover";

const chipTriggerClass =
    "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-meta font-medium outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-expanded:bg-muted";

const TYPE_ICON = {
    bug: Bug,
    feature: Lightbulb,
    task: SquareCheck,
} as const;

type TaskQuickAddChipsProperties = {
    disabled?: boolean;
    fields: QuickAddFields;
    onFieldsChange: (next: QuickAddFields) => void;
    /** True while any chip menu is open — parent should skip Input blur-close. */
    onMenuOpenChange?: (open: boolean) => void;
    projectId: string;
};

export function TaskQuickAddChips({
    disabled = false,
    fields,
    onFieldsChange,
    onMenuOpenChange,
    projectId,
}: TaskQuickAddChipsProperties) {
    const { t } = useTranslation("board");
    const { labels } = useProjectLabels(projectId);
    const people = useProjectPeople(projectId);

    const selectedLabels = labels.filter((label) =>
        fields.labelIds.includes(label.id)
    );
    const assignee = people.find((person) => person.id === fields.assigneeId);
    const TypeIcon = TYPE_ICON[fields.type];

    const notifyMenu = (open: boolean) => {
        onMenuOpenChange?.(open);
    };

    return (
        <div
            className="flex min-w-0 flex-wrap gap-1.5"
            data-task-quick-add-chips=""
            onMouseDown={(event) => {
                // Keep title Input focused so blur does not close the composer
                // before chip menu open state updates.
                event.preventDefault();
            }}
        >
            <DropdownMenu onOpenChange={notifyMenu}>
                <DropdownMenuTrigger
                    className={chipTriggerClass}
                    disabled={disabled}
                >
                    <TypeIcon
                        className={cn(
                            "size-3.5",
                            TASK_TYPE_ICON_CLASS[fields.type]
                        )}
                    />
                    <span className="truncate">
                        {t(`taskType.${fields.type}`)}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-36">
                    {TASK_TYPES.map((type) => {
                        const Icon = TYPE_ICON[type];
                        return (
                            <DropdownMenuItem
                                key={type}
                                onClick={() => {
                                    onFieldsChange({ ...fields, type });
                                }}
                            >
                                <Icon
                                    className={cn(
                                        "size-3.5",
                                        TASK_TYPE_ICON_CLASS[type]
                                    )}
                                />
                                {t(`taskType.${type}`)}
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu onOpenChange={notifyMenu}>
                <DropdownMenuTrigger
                    className={chipTriggerClass}
                    disabled={disabled}
                >
                    <Flag
                        className={cn(
                            "size-3.5",
                            fields.priority
                                ? PRIORITY_CLASS[fields.priority]
                                : "text-muted-foreground"
                        )}
                    />
                    <span className="truncate">
                        {fields.priority
                            ? t(`priority.${fields.priority}`)
                            : t("priority.none")}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-36">
                    <DropdownMenuItem
                        onClick={() => {
                            onFieldsChange({ ...fields, priority: null });
                        }}
                    >
                        {t("priority.none")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {TASK_PRIORITIES.map((priority) => (
                        <DropdownMenuItem
                            key={priority}
                            onClick={() => {
                                onFieldsChange({ ...fields, priority });
                            }}
                        >
                            <Flag
                                className={cn(
                                    "size-3.5",
                                    PRIORITY_CLASS[priority]
                                )}
                            />
                            {t(`priority.${priority}`)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu onOpenChange={notifyMenu}>
                <DropdownMenuTrigger
                    className={chipTriggerClass}
                    disabled={disabled}
                >
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="truncate">
                        {assignee?.name ?? t("fields.memberNone")}
                    </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                    <DropdownMenuItem
                        onClick={() => {
                            onFieldsChange({ ...fields, assigneeId: null });
                        }}
                    >
                        <User className="size-3.5 text-muted-foreground" />
                        {t("fields.memberNone")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {people.map((person) => (
                        <DropdownMenuItem
                            key={person.id}
                            onClick={() => {
                                onFieldsChange({
                                    ...fields,
                                    assigneeId: person.id,
                                });
                            }}
                        >
                            <span className="truncate">{person.name}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Popover onOpenChange={notifyMenu}>
                <PopoverTrigger
                    disabled={disabled}
                    render={
                        <Button
                            className={cn(
                                chipTriggerClass,
                                "hover:bg-muted dark:hover:bg-muted"
                            )}
                            disabled={disabled}
                            type="button"
                            variant="outline"
                        />
                    }
                >
                    <Tag className="size-3.5 text-muted-foreground" />
                    <span className="truncate">
                        {selectedLabels.length > 0
                            ? selectedLabels
                                  .map((label) => label.name)
                                  .join(", ")
                            : t("fields.labels")}
                    </span>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-1">
                    {labels.length === 0 ? (
                        <p className="px-2 py-1.5 text-meta text-muted-foreground">
                            {t("labels.empty")}
                        </p>
                    ) : (
                        <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                            {labels.map((label) => {
                                const selected = fields.labelIds.includes(
                                    label.id
                                );
                                const dot = getLabelDotProperties(label);
                                return (
                                    <li key={label.id}>
                                        <button
                                            className={cn(
                                                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                                                selected && "bg-accent/60"
                                            )}
                                            onClick={() => {
                                                const labelIds = selected
                                                    ? fields.labelIds.filter(
                                                          (id) =>
                                                              id !== label.id
                                                      )
                                                    : [
                                                          ...fields.labelIds,
                                                          label.id,
                                                      ];
                                                onFieldsChange({
                                                    ...fields,
                                                    labelIds,
                                                });
                                            }}
                                            type="button"
                                        >
                                            <span
                                                className={cn(
                                                    "size-2.5 shrink-0 rounded-full",
                                                    dot.className
                                                )}
                                                style={dot.style}
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                {label.name}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {fields.labelIds.length > 0 ? (
                        <button
                            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-meta text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => {
                                onFieldsChange({ ...fields, labelIds: [] });
                            }}
                            type="button"
                        >
                            {t("tasks.quickAdd.clearLabels")}
                        </button>
                    ) : null}
                </PopoverContent>
            </Popover>
        </div>
    );
}
