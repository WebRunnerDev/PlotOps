import { useNavigate, useParams } from "@tanstack/react-router";
import {
    BugIcon,
    FolderIcon,
    KanbanIcon,
    LayoutListIcon,
    MoonIcon,
    PlusIcon,
    SettingsIcon,
    SparklesIcon,
    SquareCheckBigIcon,
    SunIcon,
    WorkflowIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTheme } from "@/app/model/theme";
import { useBoardColumns } from "@/features/boards";
import { resetCommandPaletteLocalState } from "@/features/command-palette/model/reset-command-palette-local-state";
import { resolveCreateTaskColumnGate } from "@/features/command-palette/model/resolve-create-task-column-gate";
import {
    type CommandPaletteIntent,
    type CommandPaletteNavigateSection,
    type CommandPaletteTaskType,
    resolveCommandPaletteTaskHits,
    resolveCommandPaletteVisibility,
    resolveCreateTaskIntent,
    resolveNavigateIntent,
    selectTaskIntent,
    shouldRemindGuestCreateTask,
    switchProjectIntent,
} from "@/features/command-palette/model/rules";
import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
import { isGuest } from "@/features/guest-mode";
import { useProjectAccess, useProjects } from "@/features/projects";
import {
    resolveCreateTaskSprintId,
    useBoardSprints,
    useSprintsUiStore,
} from "@/features/sprints";
import {
    useBoardTasks,
    useProjectTasks,
    useTasksUiStore,
} from "@/features/tasks";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/shared/shadcn/ui/command";

const NAVIGATE_SECTIONS: CommandPaletteNavigateSection[] = [
    "board",
    "backlog",
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
    const { theme, toggleTheme } = useTheme();
    const { data: projects = [] } = useProjects();
    const { canCreateTasks, isSettled } = useProjectAccess(projectId ?? "");
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
    const { data: projectTasks = [] } = useProjectTasks(
        projectId ?? "",
        Boolean(projectId)
    );
    const selectTask = useTasksUiStore((state) => state.selectTask);
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
        isGuest: guest,
        projectId,
    };
    const paletteProjects = projects.map((project) => ({
        id: project.id,
        name: project.name,
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
    const taskHits = resolveCommandPaletteTaskHits(
        routeContext,
        paletteTasks,
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
        visibleNavigateIntents.length > 0;
    const createColumnGate = resolveCreateTaskColumnGate(
        columnsReady,
        columns[0]?.id,
        columnsError
    );

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "k"
            ) {
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
                selectTask(task.id);
                close();
            })
            .catch(() => {
                toast.error(t("command:createTaskFailed"));
            })
            .finally(() => {
                setIsCreating(false);
            });
    }

    function runNavigate(
        intent: Extract<CommandPaletteIntent, { type: "navigate" }>
    ) {
        switch (intent.section) {
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
                                        if (!projectId) return;
                                        const intent = selectTaskIntent(task);
                                        selectTask(intent.taskId);
                                        void navigate({
                                            params: {
                                                boardId: intent.boardId,
                                                projectId,
                                            },
                                            to: "/projects/$projectId/boards/$boardId",
                                        });
                                        close();
                                    }}
                                    value={`task-${task.id}`}
                                >
                                    <SquareCheckBigIcon />
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {task.key}
                                    </span>
                                    <span className="truncate">
                                        {task.title}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                    {visibility.switchProject && projectHits.length > 0 ? (
                        <CommandGroup heading={t("command:projects")}>
                            {projectHits.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    onSelect={() => {
                                        const intent = switchProjectIntent(
                                            project.id
                                        );
                                        void navigate({
                                            params: {
                                                projectId: intent.projectId,
                                            },
                                            to: "/projects/$projectId",
                                        });
                                        close();
                                    }}
                                    value={`project-${project.id}`}
                                >
                                    <FolderIcon />
                                    <span>{project.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ) : null}
                </CommandList>
            </Command>
        </CommandDialog>
    );
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
