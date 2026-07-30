import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { ProfileSettingsForm } from "@/features/auth";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    const { t } = useTranslation("common");

    return (
        <div className="flex flex-col gap-6 py-8">
            <div className="flex flex-col gap-1">
                <h1>{t("platformSettings")}</h1>
                <p className="text-body text-muted-foreground">
                    {t("settingsDescription")}
                </p>
            </div>
            <ProfileSettingsForm />
        </div>
    );
}
