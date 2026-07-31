import { SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCommandPaletteStore } from "@/features/command-palette/model/use-command-palette-store";
import { Button } from "@/shared/shadcn/ui/button";

export function CommandPaletteTrigger() {
    const { t } = useTranslation("command");
    const open = useCommandPaletteStore((state) => state.open);
    const shortcutLabel = isApplePlatform() ? t("shortcutMac") : t("shortcut");

    return (
        <Button
            aria-label={t("open")}
            className="gap-2 font-mono text-muted-foreground"
            onClick={open}
            size="sm"
            type="button"
            variant="outline"
        >
            <SearchIcon className="size-3.5" />
            <span className="hidden xl:inline">{t("open")}</span>
            <kbd className="pointer-events-none hidden h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground xl:inline-flex">
                {shortcutLabel}
            </kbd>
        </Button>
    );
}

function isApplePlatform() {
    if (typeof navigator === "undefined") {
        return false;
    }
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}
