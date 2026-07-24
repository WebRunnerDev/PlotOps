import { useNavigate } from "@tanstack/react-router";
import { FolderIcon, MoonIcon, SunIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/model/theme";
import {
    resolveCommandPaletteVisibility,
    switchProjectIntent,
} from "@/features/command-palette/model/rules";
import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
import { useProjects } from "@/features/projects";
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
    const { theme, toggleTheme } = useTheme();
    const { data: projects = [] } = useProjects();
    const isOpen = useCommandPaletteStore((state) => state.isOpen);
    const close = useCommandPaletteStore((state) => state.close);
    const open = useCommandPaletteStore((state) => state.open);
    const toggle = useCommandPaletteStore((state) => state.toggle);
    const isDark = theme === "dark";

    const paletteProjects = projects.map((project) => ({
        id: project.id,
        name: project.name,
    }));
    const visibility = resolveCommandPaletteVisibility(
        {
            boardId: null,
            canCreateTasks: false,
            projectId: null,
        },
        paletteProjects
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

    const themeLabel = isDark ? t("common:themeLight") : t("common:themeDark");

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
            <Command className="**:data-[selected=true]:bg-muted **:data-selected:bg-transparent">
                <CommandInput placeholder={t("command:placeholder")} />
                <CommandList>
                    <CommandEmpty>{t("command:empty")}</CommandEmpty>
                    <CommandGroup heading={t("command:actions")}>
                        <CommandItem
                            keywords={[themeLabel, "theme", "dark", "light"]}
                            onSelect={() => {
                                toggleTheme();
                                close();
                            }}
                            value={themeLabel}
                        >
                            {isDark ? <SunIcon /> : <MoonIcon />}
                            <span>{themeLabel}</span>
                        </CommandItem>
                    </CommandGroup>
                    {visibility.switchProject ? (
                        <CommandGroup heading={t("command:projects")}>
                            {paletteProjects.map((project) => (
                                <CommandItem
                                    key={project.id}
                                    keywords={[project.name]}
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
                                    value={`project ${project.name} ${project.id}`}
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
