import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

const locales = ["ru", "en"] as const;

export function AuthLanguageSwitcher() {
    const { i18n, t } = useTranslation("common");
    const currentLocale =
        locales.find((locale) => i18n.language.startsWith(locale)) ?? "ru";

    return (
        <div
            aria-label={t("switcher")}
            className="inline-flex rounded-lg border border-border p-0.5"
            role="group"
        >
            {locales.map((locale) => (
                <Button
                    aria-pressed={currentLocale === locale}
                    className={cn(
                        "min-w-9 px-2 uppercase",
                        currentLocale === locale && "pointer-events-none"
                    )}
                    key={locale}
                    onClick={() => void i18n.changeLanguage(locale)}
                    size="xs"
                    type="button"
                    variant={currentLocale === locale ? "secondary" : "ghost"}
                >
                    {locale}
                </Button>
            ))}
        </div>
    );
}
