import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/model/theme";
import { Button } from "@/shared/shadcn/ui/button";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const { t } = useTranslation("common");

    const isDark = theme === "dark";

    return (
        <Button
            aria-label={isDark ? t("themeLight") : t("themeDark")}
            onClick={toggleTheme}
            size="icon-sm"
            type="button"
            variant="ghost"
        >
            {isDark ? <Sun /> : <Moon />}
        </Button>
    );
}
