import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
    EpicColor,
    ProjectEpic,
    Task,
    TaskType,
} from "@/features/tasks/model/types";

import {
    convertToEpicRefusal,
    EPIC_RULE_TOAST_KEY,
} from "@/features/tasks/lib/epic-rules";
import {
    DEFAULT_EPIC_COLOR,
    EPIC_COLOR_SWATCH_CLASS,
    EPIC_COLORS,
    TASK_TYPES,
    WORK_ITEM_TASK_TYPES,
} from "@/features/tasks/model/constants";
import { EpicBadge, EpicColorDot } from "@/features/tasks/ui/epic-badge";
import { TaskTypeIcon } from "@/features/tasks/ui/task-type-icon";
import { cn } from "@/shared/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

const NO_EPIC = "__none__";

/** Colour swatches for an Epic's badge. */
export function EpicColorField({
    canEdit,
    labelledBy,
    onChange,
    value,
}: {
    canEdit: boolean;
    labelledBy: string;
    onChange: (color: EpicColor) => void;
    value?: EpicColor;
}) {
    const { t } = useTranslation("board");
    const selected = value ?? DEFAULT_EPIC_COLOR;
    return (
        <div
            aria-labelledby={labelledBy}
            className="flex flex-wrap gap-1.5"
            role="radiogroup"
        >
            {EPIC_COLORS.map((color) => {
                const checked = color === selected;
                return (
                    <button
                        aria-checked={checked}
                        aria-label={t(`epics.colors.${color}`)}
                        className={cn(
                            "inline-flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60",
                            EPIC_COLOR_SWATCH_CLASS[color],
                            checked && "ring-2 ring-foreground/60"
                        )}
                        disabled={!canEdit}
                        key={color}
                        onClick={() => {
                            if (!checked) onChange(color);
                        }}
                        role="radio"
                        title={t(`epics.colors.${color}`)}
                        type="button"
                    >
                        {checked ? (
                            <Check
                                aria-hidden
                                className="size-3.5 text-white"
                            />
                        ) : undefined}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Epic membership for level-0 Tasks: picker for roots, read-only inherited
 * Epic for Subtasks. Not rendered for Epics (see {@link EpicColorField}).
 */
export function TaskEpicField({
    canEdit,
    className,
    epics,
    epicsById,
    id,
    onChange,
    task,
}: {
    canEdit: boolean;
    className?: string;
    epics: readonly ProjectEpic[];
    epicsById: ReadonlyMap<string, ProjectEpic>;
    id: string;
    onChange: (epicId: null | string) => void;
    task: Pick<Task, "epicId" | "parentEpicId" | "parentId">;
}) {
    const { t } = useTranslation("board");

    if (task.parentId !== undefined) {
        const inherited = task.parentEpicId
            ? epicsById.get(task.parentEpicId)
            : undefined;
        return (
            <div className="flex min-w-0 flex-col gap-1">
                {inherited ? (
                    <EpicBadge
                        className="self-start text-meta"
                        color={inherited.color}
                        title={inherited.title}
                    />
                ) : (
                    <span className="text-ui text-muted-foreground">
                        {t("epics.none")}
                    </span>
                )}
                <p className="text-meta text-muted-foreground">
                    {t("epics.inheritedFromParent")}
                </p>
            </div>
        );
    }

    const current = task.epicId ? epicsById.get(task.epicId) : undefined;
    // Archived / Done Epics stay listed only when this Task already points at one.
    const options = epics.filter(
        (epic) => epic.archivedAt === undefined || epic.id === task.epicId
    );

    return (
        <Select
            disabled={!canEdit}
            onValueChange={(value) => {
                if (typeof value !== "string") return;
                const next = value === NO_EPIC ? null : value;
                if (next === (task.epicId ?? null)) return;
                onChange(next);
            }}
            value={task.epicId ?? NO_EPIC}
        >
            <SelectTrigger className={className} id={id}>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    {current ? (
                        <>
                            <EpicColorDot color={current.color} />
                            <span className="truncate">{current.title}</span>
                        </>
                    ) : (
                        <span className="truncate text-muted-foreground">
                            {t("epics.none")}
                        </span>
                    )}
                </span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
                <SelectItem value={NO_EPIC}>{t("epics.none")}</SelectItem>
                {options.map((epic) => (
                    <SelectItem key={epic.id} value={epic.id}>
                        <EpicColorDot color={epic.color} />
                        <span className="max-w-56 truncate">{epic.title}</span>
                        <span className="font-mono text-meta text-muted-foreground">
                            {epic.key}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/**
 * Task type picker with Epic hierarchy rules (ADR 0031): converting to / from
 * Epic is Manager+, and only when the Task has no Parent, Sprint, Subtasks —
 * or, for an Epic, no Tasks left in it.
 */
export function TaskTypeField({
    canEdit,
    canManageEpics,
    className,
    epicTaskCount,
    id,
    onChange,
    task,
    tasks,
}: {
    canEdit: boolean;
    /** Manager+ — may create / convert Epics. */
    canManageEpics: boolean;
    className?: string;
    /** Tasks currently in this Epic (0 when not an Epic). */
    epicTaskCount: number;
    id: string;
    onChange: (type: TaskType) => void;
    task: Pick<Task, "id" | "parentId" | "sprintId" | "type">;
    /** Known Tasks — used to detect Subtasks of `task`. */
    tasks: readonly Pick<Task, "parentId">[];
}) {
    const { t } = useTranslation("board");
    const isEpic = task.type === "epic";
    const options =
        task.parentId === undefined ? TASK_TYPES : WORK_ITEM_TASK_TYPES;
    const toEpicRefusal = isEpic ? null : convertToEpicRefusal(task, tasks);
    const epicBlockedHint = isEpic
        ? canManageEpics
            ? epicTaskCount > 0
                ? t("epics.errors.epicHasMembers")
                : undefined
            : t("epics.errors.managerOnly")
        : undefined;

    const isOptionDisabled = (type: TaskType) => {
        if (type === task.type) return false;
        if (isEpic) return !canManageEpics || epicTaskCount > 0;
        if (type === "epic") return !canManageEpics || toEpicRefusal !== null;
        return false;
    };

    const epicOptionHint =
        !isEpic && task.parentId === undefined
            ? canManageEpics
                ? toEpicRefusal
                    ? t(EPIC_RULE_TOAST_KEY[toEpicRefusal])
                    : undefined
                : t("epics.errors.managerOnly")
            : undefined;

    return (
        <>
            <Select
                disabled={!canEdit}
                onValueChange={(value) => {
                    if (typeof value !== "string" || value === task.type)
                        return;
                    onChange(value as TaskType);
                }}
                value={task.type}
            >
                <SelectTrigger className={className} id={id}>
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                        <TaskTypeIcon type={task.type} />
                        <span className="truncate">
                            {t(`taskType.${task.type}`)}
                        </span>
                    </span>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                    {options.map((type) => (
                        <SelectItem
                            disabled={isOptionDisabled(type)}
                            key={type}
                            title={type === "epic" ? epicOptionHint : undefined}
                            value={type}
                        >
                            <TaskTypeIcon type={type} />
                            {t(`taskType.${type}`)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {epicBlockedHint && canEdit ? (
                <p className="text-meta text-muted-foreground">
                    {epicBlockedHint}
                </p>
            ) : undefined}
        </>
    );
}
