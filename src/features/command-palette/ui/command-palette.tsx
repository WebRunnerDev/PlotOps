import { useNavigate, useParams } from "@tanstack/react-router";
import {
    ArchiveIcon,
    BanIcon,
    BugIcon,
    CornerUpLeftIcon,
    FolderIcon,
    KanbanIcon,
    LayoutListIcon,
    MoonIcon,
    PlusIcon,
    SettingsIcon,
    SparklesIcon,
    SquareCheckBigIcon,
    SunIcon,
    UsersIcon,
    WorkflowIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTheme } from "@/app/model/theme";
import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { useBoardColumns } from "@/features/boards";
import { isCommandPaletteShortcut } from "@/features/command-palette/model/command-palette-shortcut";
import { resetCommandPaletteLocalState } from "@/features/command-palette/model/reset-command-palette-local-state";
import { resolveCreateTaskColumnGate } from "@/features/command-palette/model/resolve-create-task-column-gate";
import {
    type CommandPaletteIntent,
    type CommandPaletteMember,
    type CommandPaletteNavigateSection,
    type CommandPaletteTaskType,
    openMemberSettingsIntent,
    resolveCommandPaletteMemberHits,
    resolveCommandPaletteTaskHits,
    resolveCommandPaletteVisibility,
    resolveCreateTaskIntent,
    resolveJumpTaskIntents,
    resolveNavigateIntent,
    selectTaskIntent,
    shouldRemindGuestCreateTask,
    switchProjectIntent,
} from "@/features/command-palette/model/rules";
import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
import { isGuest } from "@/features/guest-mode";
import { useProject, useProjectAccess, useProjects } from "@/features/projects";
import {
    resolveCreateTaskSprintId,
    useBoardSprints,
    useSprintsUiStore,
} from "@/features/sprints";
import {
    useBoardTasks,
    useProjectTasks,
    useTaskDrawerPreferencesStore,
    useTasksUiStore,
} from "@/features/tasks";
import { maybeSelectCreatedTask } from "@/features/tasks/lib/resolve-task-drawer-placement";
import { useTeamAccess } from "@/features/teams";
import {
    useTeam,
    useTeamMembers,
    useTeamOwnerProfile,
} from "@/features/teams/model/use-team-members";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/shared/shadcn/ui/command";
import { Label } from "@/shared/shadcn/ui/label";

const NAVIGATE_SECTIONS: CommandPaletteNavigateSection[] = [
    "board",
    "backlog",
    "archive",
    "cicd",
    "settings",
];

const CREATE_TASK_TYPES: CommandPaletteTaskType[] = ["task", "bug", "feature"];

export function CommandPalette() {
    const { t } = useTranslation(["command", "common"]);
    const navigate = useNavigate();
    const parameters = useParams({ strict: false });
    const guest = isGuest();
    const projectId =
        typeof parameters.projectId === "string" ? parameters.projectId : null;
    const boardId =
        typeof parameters.boardId === "string" ? parameters.boardId : null;
    const teamIdFromRoute =
        typeof parameters.teamId === "string" ? parameters.teamId : null;
    const { theme, toggleTheme } = useTheme();
    const { data: projects = [] } = useProjects();
    const { data: project } = useProject(projectId ?? "");
    const teamId = teamIdFromRoute ?? project?.team_id ?? null;
    const { canCreateTasks, isSettled } = useProjectAccess(projectId ?? "");
    const teamAccess = useTeamAccess(teamId ?? "");
    const { data: team } = useTeam(teamId ?? "");
    const { data: teamMembers = [] } = useTeamMembers(teamId ?? "");
    const { data: ownerProfile } = useTeamOwnerProfile(team?.owner_id);
    const { columns, columnsError, columnsReady } = useBoardColumns(
        projectId ?? "",
        boardId ?? ""
    );
    const { createTask } = useBoardTasks(projectId ?? "", boardId ?? "");
    const { data: sprints = [] } = useBoardSprints(boardId ?? "");
    const boardSprintScope = useSprintsUiStore(
        (state) => state.boardSprintScope
    );
    const createSprintId = resolveCreateTaskSprintId({
        activeSprintId: sprints.find((sprint) => sprint.state === "active")?.id,
        boardSprintScope,
    });
    const [includeArchived, setIncludeArchived] = useState(false);
    const { data: projectTasks = [] } = useProjectTasks(
        projectId ?? "",
        Boolean(projectId),
        { includeArchived }
    );
    const { data: jumpTasks = [] } = useProjectTasks(
        projectId ?? "",
        Boolean(projectId),
        { includeArchived: true }
    );
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const openAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.openAfterCreate
    );
    const requestOpenArchiveDialog = useTasksUiStore(
        (state) => state.requestOpenArchiveDialog
    );
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const isOpen = useCommandPaletteStore((state) => state.isOpen);
    const close = useCommandPaletteStore((state) => state.close);
    const open = useCommandPaletteStore((state) => state.open);
    const toggle = useCommandPaletteStore((state) => state.toggle);
    const [query, setQuery] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const isDark = theme === "dark";
    const themeLabel = isDark ? t("common:themeLight") : t("common:themeDark");
    const normalizedQuery = query.trim().toLowerCase();

    const routeContext = {
        boardId,
        canCreateTasks: isSettled && canCreateTasks,
        canViewMembers: teamAccess.isSettled && teamAccess.canView,
        isGuest: guest,
        projectId,
        teamId,
    };
    const paletteProjects = projects.map((projectItem) => ({
        id: projectItem.id,
        name: projectItem.name,
    }));
    const visibility = resolveCommandPaletteVisibility(
        routeContext,
        paletteProjects
    );
    const createIntents = CREATE_TASK_TYPES.map((taskType) =>
        resolveCreateTaskIntent(routeContext, query, taskType)
    ).filter(
        (
            intent
        ): intent is Extract<CommandPaletteIntent, { type: "create-task" }> =>
            intent !== null
    );
    const navigateIntents = NAVIGATE_SECTIONS.map((section) =>
        resolveNavigateIntent(routeContext, section)
    ).filter(
        (
            intent
        ): intent is Extract<CommandPaletteIntent, { type: "navigate" }> =>
            intent !== null
    );
    const paletteTasks = projectTasks.map((task) => ({
        archivedAt: task.archivedAt,
        boardId: task.boardId,
        id: task.id,
        key: task.key,
        title: task.title,
    }));
    const jumpCatalog = jumpTasks.map((task) => ({
        archivedAt: task.archivedAt,
        boardId: task.boardId,
        hasOpenBlocker: task.hasOpenBlocker,
        id: task.id,
        key: task.key,
        parentId: task.parentId,
        relatedTasks: task.relatedTasks,
    }));
    const taskHits = resolveCommandPaletteTaskHits(
        routeContext,
        paletteTasks,
        query,
        { includeArchived }
    );
    const jumpIntents = resolveJumpTaskIntents(selectedTaskId, jumpCatalog);
    const visibleJumpIntents = jumpIntents.filter((jump) =>
        matchesJumpQuery(jump.kind, jump.targetKey, normalizedQuery, t)
    );
    const paletteMembers = buildPaletteMembers(
        ownerProfile,
        teamMembers,
        t("command:unknownMember")
    );
    const memberHits = resolveCommandPaletteMemberHits(
        routeContext,
        paletteMembers,
        query
    );
    const showTheme =
        normalizedQuery.length === 0 ||
        themeLabel.toLowerCase().includes(normalizedQuery) ||
        ["theme", "dark", "light"].some((keyword) =>
            keyword.includes(normalizedQuery)
        );
    const projectHits =
        normalizedQuery.length === 0
            ? paletteProjects
            : paletteProjects.filter((project) =>
                  project.name.toLowerCase().includes(normalizedQuery)
              );
    const visibleNavigateIntents = navigateIntents.filter((intent) =>
        matchesNavigateQuery(intent.section, normalizedQuery, t)
    );
    const showActions =
        showTheme ||
        createIntents.length > 0 ||
        visibleNavigateIntents.length > 0 ||
        visibleJumpIntents.length > 0;
    const createColumnGate = resolveCreateTaskColumnGate(
        columnsReady,
        columns[0]?.id,
        columnsError
    );

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (isCommandPaletteShortcut(event)) {
                event.preventDefault();
                toggle();
            }
        }

        globalThis.addEventListener("keydown", onKeyDown);
        return () => {
            globalThis.removeEventListener("keydown", onKeyDown);
        };
    }, [toggle]);

    useEffect(() => {
        if (isOpen) return;
        const reset = resetCommandPaletteLocalState();
        setQuery(reset.query);
    }, [isOpen]);

    function runCreateTask(
        intent: Extract<CommandPaletteIntent, { type: "create-task" }>
    ) {
        if (isCreating || !projectId) return;
        if (createColumnGate === "loading") {
            toast.message(t("command:columnsLoading"));
            return;
        }
        if (createColumnGate === "error") {
            toast.error(t("command:columnsLoadFailed"));
            return;
        }
        if (createColumnGate === "empty") {
            toast.error(t("command:createTaskFailed"));
            return;
        }

        const firstColumn = columns[0];
        if (!firstColumn) {
            toast.error(t("command:createTaskFailed"));
            return;
        }

        setIsCreating(true);
        void createTask(firstColumn.id, intent.title, {
            sprintId: createSprintId,
            taskType: intent.taskType,
        })
            .then((task) => {
                if (shouldRemindGuestCreateTask(guest)) {
                    toast.message(t("command:guestCreateReminder"));
                }
                maybeSelectCreatedTask(task.id, {
                    openAfterCreate,
                    selectTask,
                });
                close();
            })
            .catch(() => {
                toast.error(t("command:createTaskFailed"));
            })
            .finally(() => {
                setIsCreating(false);
            });
    }

    function runSelectTask(
        intent: Extract<CommandPaletteIntent, { type: "select-task" }>
    ) {
        if (!projectId) return;
        selectTask(intent.taskId);
        void navigate({
            params: {
                boardId: intent.boardId,
                projectId,
            },
            search: { task: intent.taskKey },
            to: "/projects/$projectId/boards/$boardId",
        });
        close();
    }

    function runNavigate(
        intent: Extract<CommandPaletteIntent, { type: "navigate" }>
    ) {
        switch (intent.section) {
            case "archive": {
                if (!intent.boardId) return;
                requestOpenArchiveDialog();
                void navigate({
                    params: {
                        boardId: intent.boardId,
                        projectId: intent.projectId,
                    },
                    to: "/projects/$projectId/boards/$boardId",
                });
                break;
            }
            case "backlog": {
                if (!intent.boardId) return;
                void navigate({
                    params: {
                        boardId: intent.boardId,
                        projectId: intent.projectId,
                    },
                    to: "/projects/$projectId/boards/$boardId/backlog",
                });
                break;
            }
            case "board": {
                if (!intent.boardId) return;
                void navigate({
                    params: {
                        boardId: intent.boardId,
                        projectId: intent.projectId,
                    },
                    to: "/projects/$projectId/boards/$boardId",
                });
                break;
            }
            case "cicd": {
                void navigate({
                    params: { projectId: intent.projectId },
                    to: "/projects/$projectId/ci-cd",
                });
                break;
            }
            case "settings": {
                void navigate({
                    params: { projectId: intent.projectId },
                    to: "/projects/$projectId/settings",
                });
                break;
            }
        }
        close();
    }

    return (
        <CommandDialog
            description={t("command:description")}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    open();
                } else {
                    close();
                }
            }}
            open={isOpen}
            title={t("command:title")}
        >
            <Command
                className="**:data-[selected=true]:bg-muted **:data-selected:bg-transparent"
                shouldFilter={false}
            >
                <CommandInput
                    onValueChange={setQuery}
                    placeholder={t("command:placeholder")}
                    value={query}
                />
                {visibility.tasks ? (
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                        <Checkbox
                            checked={includeArchived}
                            id="command-include-archived"
                            onCheckedChange={(checked) => {
                                setIncludeArchived(checked === true);
                            }}
                        />
                        <Label
                            className="cursor-pointer text-xs font-normal text-muted-foreground"
                            htmlFor="command-include-archived"
                        >
                            {t("command:includeArchived")}
                        </Label>
                    </div>
                ) : null}
                <CommandList>
                    <CommandEmpty>{t("command:empty")}</CommandEmpty>
                    {showActions ? (
                        <CommandGroup heading={t("command:actions")}>
                            {showTheme ? (
                                <CommandItem
                                    onSelect={() => {
                                        toggleTheme();
                                        close();
                                    }}
                                    value={themeLabel}
                                >
                                    {isDark ? <SunIcon /> : <MoonIcon />}
                                    <span>{themeLabel}</span>
                                </CommandItem>
                            ) : null}
                            {visibleNavigateIntents.map((intent) => (
                                <CommandItem
                                    key={intent.section}
                                    onSelect={() => {
                                        runNavigate(intent);
                                    }}
                                    value={`navigate-${intent.section}`}
                                >
                                    {navigateSectionIcon(intent.section)}
                                    <span>
                                        {t(
                                            `command:navigate.${intent.section}`
                                        )}
                                    </span>
                                </CommandItem>
                            ))}
                            {visibleJumpIntents.map((jump) => (
                                <CommandItem
                                    key={`${jump.kind}-${jump.intent.taskId}`}
                                    onSelect={() => {
                                        runSelectTask(jump.intent);
                                    }}
                                    value={`jump-${jump.kind}-${jump.intent.taskId}`}
                                >
                                    {jump.kind === "parent" ? (
                                        <CornerUpLeftIcon />
                                    ) : (
                                        <BanIcon />
                                    )}
                                    <span>
                                        {jump.kind === "parent"
                                            ? t("command:goToParent")
                                            : t("command:goToBlockingTask", {
                                                  key: jump.targetKey,
                                              })}
                                    </span>
                                </CommandItem>
                            ))}
                            {createIntents.map((intent) => (
                                <CommandItem
                                    disabled={
                                        isCreating ||
                                        createColumnGate === "loading"
                                    }
                                    key={intent.taskType}
                                    onSelect={() => {
                                        runCreateTask(intent);
                                    }}
                                    value={`create-${intent.taskType}-${intent.title}`}
                                >
                                    {createTaskTypeIcon(intent.taskType)}
                                    <span>
                                        {t(
                                            createTaskLabelKey(intent.taskType),
                                            { title: intent.title }
                                        )}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                    {visibility.tasks && taskHits.length > 0 ? (
                        <CommandGroup heading={t("command:tasks")}>
                            {taskHits.map((task) => (
                                <CommandItem
                                    key={task.id}
                                    onSelect={() => {
                                        runSelectTask(selectTaskIntent(task));
                                    }}
                                    value={`task-${task.id}`}
                                >
                                    <SquareCheckBigIcon />
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {task.key}
                                    </span>
                                    <span className="min-w-0 truncate">
                                        {task.title}
                                    </span>
                                    {task.archivedAt ? (
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {t("command:archivedBadge")}
                                        </span>
                                    ) : null}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                    {visibility.searchMembers && memberHits.length > 0 ? (
                        <CommandGroup heading={t("command:members")}>
                            {memberHits.map((member) => (
                                <CommandItem
                                    key={member.userId}
                                    onSelect={() => {
                                        if (!teamId) return;
                                        const intent = openMemberSettingsIntent(
                                            teamId,
                                            member.userId
                                        );
                                        void navigate({
                                            params: { teamId: intent.teamId },
                                            to: "/teams/$teamId/settings",
                                        });
                                        close();
                                    }}
                                    value={`member-${member.userId}`}
                                >
                                    <UsersIcon />
                                    <span className="min-w-0 truncate">
                                        {member.displayName}
                                    </span>
                                    {member.username ? (
                                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                            @{member.username}
                                        </span>
                                    ) : null}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                    {visibility.switchProject && projectHits.length > 0 ? (
                        <CommandGroup heading={t("command:projects")}>
                            {projectHits.map((projectItem) => (
                                <CommandItem
                                    key={projectItem.id}
                                    onSelect={() => {
                                        const intent = switchProjectIntent(
                                            projectItem.id
                                        );
                                        void navigate({
                                            params: {
                                                projectId: intent.projectId,
                                            },
                                            to: "/projects/$projectId",
                                        });
                                        close();
                                    }}
                                    value={`project-${projectItem.id}`}
                                >
                                    <FolderIcon />
                                    <span>{projectItem.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                </CommandList>
            </Command>
        </CommandDialog>
    );
}

function buildPaletteMembers(
    ownerProfile:
        | null
        | undefined
        | {
              first_name: null | string;
              id: string;
              last_name: null | string;
              username: null | string;
          },
    teamMembers: readonly {
        profile: null | {
            first_name: null | string;
            last_name: null | string;
            username: null | string;
        };
        user_id: string;
    }[],
    unknownLabel: string
): CommandPaletteMember[] {
    const byId = new Map<string, CommandPaletteMember>();

    if (ownerProfile) {
        byId.set(ownerProfile.id, {
            displayName: formatProfileDisplayName(ownerProfile) || unknownLabel,
            userId: ownerProfile.id,
            username: ownerProfile.username,
        });
    }

    for (const member of teamMembers) {
        if (!member.profile) continue;
        byId.set(member.user_id, {
            displayName:
                formatProfileDisplayName(member.profile) || unknownLabel,
            userId: member.user_id,
            username: member.profile.username,
        });
    }

    return [...byId.values()];
}

function createTaskLabelKey(
    taskType: CommandPaletteTaskType
):
    | "command:createBugWithTitle"
    | "command:createFeatureWithTitle"
    | "command:createTaskWithTitle" {
    if (taskType === "bug") return "command:createBugWithTitle";
    if (taskType === "feature") return "command:createFeatureWithTitle";
    return "command:createTaskWithTitle";
}

function createTaskTypeIcon(taskType: CommandPaletteTaskType) {
    if (taskType === "bug") return <BugIcon />;
    if (taskType === "feature") return <SparklesIcon />;
    return <PlusIcon />;
}

function matchesJumpQuery(
    kind: "blocker" | "parent",
    targetKey: string,
    normalizedQuery: string,
    translate: (key: string, options?: Record<string, string>) => string
): boolean {
    if (normalizedQuery.length === 0) {
        return true;
    }

    const label =
        kind === "parent"
            ? translate("command:goToParent").toLowerCase()
            : translate("command:goToBlockingTask", {
                  key: targetKey,
              }).toLowerCase();
    if (
        label.includes(normalizedQuery) ||
        targetKey.toLowerCase().includes(normalizedQuery)
    ) {
        return true;
    }

    const keywords =
        kind === "parent"
            ? ["parent", "родитель", "subtask"]
            : ["block", "blocker", "blocking", "блокер", "блокир"];

    return keywords.some(
        (keyword) =>
            keyword.includes(normalizedQuery) ||
            normalizedQuery.includes(keyword)
    );
}

function matchesNavigateQuery(
    section: CommandPaletteNavigateSection,
    normalizedQuery: string,
    translate: (key: string) => string
): boolean {
    if (normalizedQuery.length === 0) {
        return true;
    }

    const label = translate(`command:navigate.${section}`).toLowerCase();
    if (label.includes(normalizedQuery)) {
        return true;
    }

    const keywords: Record<CommandPaletteNavigateSection, string[]> = {
        archive: ["archive", "archived", "архив"],
        backlog: ["backlog", "бэклог", "бэклоги"],
        board: ["board", "доска", "kanban"],
        cicd: ["ci", "cicd", "ci/cd", "pipeline", "ci cd"],
        settings: ["settings", "настройки", "setting"],
    };

    return keywords[section].some(
        (keyword) =>
            keyword.includes(normalizedQuery) ||
            normalizedQuery.includes(keyword)
    );
}

function navigateSectionIcon(section: CommandPaletteNavigateSection) {
    switch (section) {
        case "archive": {
            return <ArchiveIcon />;
        }
        case "backlog": {
            return <LayoutListIcon />;
        }
        case "board": {
            return <KanbanIcon />;
        }
        case "cicd": {
            return <WorkflowIcon />;
        }
        case "settings": {
            return <SettingsIcon />;
        }
    }
}
