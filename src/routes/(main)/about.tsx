import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/(main)/about")({
    component: AboutPage,
});

function AboutPage() {
    const { t } = useTranslation("about");

    return (
        <div className="flex min-w-0 flex-col gap-4 break-words py-8">
            <h1 className="text-h1">{t("title")}</h1>
            <p className="text-body text-muted-foreground">
                {t("description")}
            </p>
        </div>
    );
}
