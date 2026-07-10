import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    const { t } = useTranslation("common");

    return (
        <div className="flex flex-col gap-4 py-8">
            <h1>{t("platformSettings")}</h1>
            <p className="text-body text-muted-foreground">
                {t("settingsPlaceholder")}
            </p>
        </div>
    );
}
