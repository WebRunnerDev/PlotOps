import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/(main)/dashboard")({
    component: DashboardPage,
});

function DashboardPage() {
    const { t } = useTranslation("dashboard");

    return (
        <div className="px-4 py-8">
            <h1>{t("title")}</h1>
        </div>
    );
}
