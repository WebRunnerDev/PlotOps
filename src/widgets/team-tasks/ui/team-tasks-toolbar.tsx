import type { ReactNode } from "react";

import { FolderGit2, Group, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    BoardHideCompletedControl,
    BoardSortControl,
    type BoardSortPreference,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import {
    ANY_ASSIGNEE_FILTER,
    ME_ASSIGNEE_FILTER,
    TEAM_TASKS_GROUP_BY,
    TEAM_TASKS_SORT_FIELDS,
    type TeamTasksGroupBy,
    type TeamTasksPreferences,
    type TeamTasksSortField,
    UNASSIGNED_ASSIGNEE_FILTER,
} from "@/widgets/team-tasks/model/team-tasks-view";

export type TeamTasksToolbarPerson = {
    id: string;
    name: string;
};

export type TeamTasksToolbarProject = {
    id: string;
    name: string;
};

type TeamTasksToolbarProperties = {
    onChange: (patch: Partial<TeamTasksPreferences>) => void;
    /** Assignees to offer besides Me / Anyone / Unassigned. */
    people: TeamTasksToolbarPerson[];
    preferences: TeamTasksPreferences;
    projects: TeamTasksToolbarProject[];
};

const MENU_TRIGGER_CLASS =
    "inline-flex h-7 max-w-full cursor-pointer items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted";

const ASSIGNEE_SENTINELS = [
    ME_ASSIGNEE_FILTER,
    ANY_ASSIGNEE_FILTER,
    UNASSIGNED_ASSIGNEE_FILTER,
] as const;

export function TeamTasksToolbar({
    onChange,
    people,
    preferences,
    projects,
}: TeamTasksToolbarProperties) {
    const { t } = useTranslation("board");
    const selectedProjectIds = preferences.projectIds;
    const assigneeLabel =
        people.find((person) => person.id === preferences.assignee)?.name ??
        t(assigneeSentinelKey(preferences.assignee));

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ToolbarMenu
                active={preferences.groupBy !== "project"}
                icon={<Group aria-hidden className="size-3.5" />}
                label={t("teamTasks.groupBy.label")}
                value={t(`teamTasks.groupBy.${preferences.groupBy}`)}
            >
                <DropdownMenuRadioGroup
                    onValueChange={(next) => {
                        onChange({ groupBy: next as TeamTasksGroupBy });
                    }}
                    value={preferences.groupBy}
                >
                    <DropdownMenuLabel>
                        {t("teamTasks.groupBy.label")}
                    </DropdownMenuLabel>
                    {TEAM_TASKS_GROUP_BY.map((groupBy) => (
                        <DropdownMenuRadioItem key={groupBy} value={groupBy}>
                            {t(`teamTasks.groupBy.${groupBy}`)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </ToolbarMenu>

            <BoardSortControl
                allowManual={false}
                fields={TEAM_TASKS_SORT_FIELDS}
                onChange={(sort: BoardSortPreference) => {
                    if (sort.field === "manual") return;
                    onChange({
                        sort: {
                            direction: sort.direction,
                            field: sort.field as TeamTasksSortField,
                        },
                    });
                }}
                value={preferences.sort}
            />

            <div className="flex flex-wrap items-center gap-2">
                <ToolbarMenu
                    active={selectedProjectIds.length > 0}
                    count={selectedProjectIds.length}
                    icon={<FolderGit2 aria-hidden className="size-3.5" />}
                    label={t("teamTasks.filters.project")}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            {t("teamTasks.filters.project")}
                        </DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={selectedProjectIds.length === 0}
                            onCheckedChange={() => {
                                onChange({ projectIds: [] });
                            }}
                        >
                            {t("teamTasks.filters.allProjects")}
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {projects.map((project) => (
                            <DropdownMenuCheckboxItem
                                checked={selectedProjectIds.includes(
                                    project.id
                                )}
                                key={project.id}
                                onCheckedChange={() => {
                                    onChange({
                                        projectIds: toggleValue(
                                            selectedProjectIds,
                                            project.id
                                        ),
                                    });
                                }}
                            >
                                <span className="min-w-0 truncate">
                                    {project.name}
                                </span>
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                </ToolbarMenu>

                <ToolbarMenu
                    active={preferences.assignee !== ANY_ASSIGNEE_FILTER}
                    icon={<User aria-hidden className="size-3.5" />}
                    label={t("fields.assignee")}
                    value={assigneeLabel}
                >
                    <DropdownMenuRadioGroup
                        onValueChange={(next) => {
                            onChange({ assignee: next as string });
                        }}
                        value={preferences.assignee}
                    >
                        <DropdownMenuLabel>
                            {t("fields.assignee")}
                        </DropdownMenuLabel>
                        {ASSIGNEE_SENTINELS.map((sentinel) => (
                            <DropdownMenuRadioItem
                                key={sentinel}
                                value={sentinel}
                            >
                                {t(assigneeSentinelKey(sentinel))}
                            </DropdownMenuRadioItem>
                        ))}
                        {people.length > 0 ? (
                            <DropdownMenuSeparator />
                        ) : undefined}
                        {people.map((person) => (
                            <DropdownMenuRadioItem
                                key={person.id}
                                value={person.id}
                            >
                                <span className="min-w-0 truncate">
                                    {person.name}
                                </span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </ToolbarMenu>

                <BoardHideCompletedControl
                    hideCompleted={preferences.hideDone}
                    onChange={(hideDone) => {
                        onChange({ hideDone });
                    }}
                />
            </div>
        </div>
    );
}

/** Label key for an Assignee filter sentinel. */
function assigneeSentinelKey(
    assignee: string
):
    | "teamTasks.assignee.any"
    | "teamTasks.assignee.me"
    | "teamTasks.assignee.unassigned" {
    if (assignee === ANY_ASSIGNEE_FILTER) return "teamTasks.assignee.any";
    if (assignee === UNASSIGNED_ASSIGNEE_FILTER) {
        return "teamTasks.assignee.unassigned";
    }
    return "teamTasks.assignee.me";
}

function toggleValue(values: string[], value: string): string[] {
    return values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
}

function ToolbarMenu({
    active,
    children,
    count = 0,
    icon,
    label,
    value,
}: {
    active: boolean;
    children: ReactNode;
    count?: number;
    icon: ReactNode;
    label: string;
    /** Current choice shown in the trigger; omit for multi-select menus. */
    value?: string;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={value ? `${label}: ${value}` : label}
                className={cn(
                    MENU_TRIGGER_CLASS,
                    active && "border-primary/40 bg-primary/5"
                )}
            >
                {icon}
                <span className="min-w-0 truncate">{value ?? label}</span>
                {count > 0 ? (
                    <Badge
                        className="h-4 min-w-4 rounded-sm px-1 font-mono text-[0.625rem]"
                        variant="secondary"
                    >
                        {count}
                    </Badge>
                ) : undefined}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
