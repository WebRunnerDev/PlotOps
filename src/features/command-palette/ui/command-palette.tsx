import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/model/theme";
import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
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
    const { theme, toggleTheme } = useTheme();
    const isOpen = useCommandPaletteStore((state) => state.isOpen);
    const close = useCommandPaletteStore((state) => state.close);
    const open = useCommandPaletteStore((state) => state.open);
    const toggle = useCommandPaletteStore((state) => state.toggle);
    const isDark = theme === "dark";

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
                </CommandList>
            </Command>
        </CommandDialog>
    );
}
