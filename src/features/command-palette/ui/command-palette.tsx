import { useNavigate, useParams } from "@tanstack/react-router";
import {
    FolderIcon,
    MoonIcon,
    PlusIcon,
    SquareCheckBigIcon,
    SunIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useTheme } from "@/app/model/theme";
import { useBoardColumns } from "@/features/boards";
import {
    resolveCommandPaletteTaskHits,
    resolveCommandPaletteVisibility,
    resolveCreateTaskIntent,
    selectTaskIntent,
    switchProjectIntent,
} from "@/features/command-palette/model/rules";
import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
import { useProjectAccess, useProjects } from "@/features/projects";
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

export function CommandPalette() {
    const { t } = useTranslation(["command", "common"]);
    const navigate = useNavigate();
    const parameters = useParams({ strict: false });
    const projectId =
        typeof parameters.projectId === "string" ? parameters.projectId : null;
    const boardId =
        typeof parameters.boardId === "string" ? parameters.boardId : null;
    const { theme, toggleTheme } = useTheme();
    const { data: projects = [] } = useProjects();
    const { canCreateTasks } = useProjectAccess(projectId ?? "");
    const { columns } = useBoardColumns(projectId ?? "", boardId ?? "");
    const { createTask } = useBoardTasks(projectId ?? "", boardId ?? "");
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
        canCreateTasks,
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
    const createIntent = resolveCreateTaskIntent(routeContext, query);
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
    const showActions = showTheme || createIntent !== null;

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

    return (
        <CommandDialog
            description={t("command:description")}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    open();
                } else {
                    close();
                    setQuery("");
                    setIsCreating(false);
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
                            {createIntent ? (
                                <CommandItem
                                    disabled={isCreating}
                                    onSelect={() => {
                                        if (isCreating || !projectId) return;
                                        const firstColumn = columns[0];
                                        if (!firstColumn) {
                                            toast.error(
                                                t("command:createTaskFailed")
                                            );
                                            return;
                                        }

                                        setIsCreating(true);
                                        void createTask(
                                            firstColumn.id,
                                            createIntent.title
                                        )
                                            .then((task) => {
                                                selectTask(task.id);
                                                close();
                                                setQuery("");
                                            })
                                            .catch(() => {
                                                toast.error(
                                                    t(
                                                        "command:createTaskFailed"
                                                    )
                                                );
                                            })
                                            .finally(() => {
                                                setIsCreating(false);
                                            });
                                    }}
                                    value={`create-task-${createIntent.title}`}
                                >
                                    <PlusIcon />
                                    <span>
                                        {t("command:createTaskWithTitle", {
                                            title: createIntent.title,
                                        })}
                                    </span>
                                </CommandItem>
                            ) : null}
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
