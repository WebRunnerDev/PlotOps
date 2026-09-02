import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LegalFooterLinks } from "@/features/legal";
import {
    PLOTOPS_GITHUB_URL,
    PLOTOPS_LICENSE,
} from "@/shared/config/open-source";
import { Button } from "@/shared/shadcn/ui/button";

export const Route = createFileRoute("/(main)/about")({
    component: AboutPage,
});

function AboutPage() {
    const { t } = useTranslation("about");

    return (
        <div className="flex min-w-0 flex-col gap-4 wrap-break-word py-8">
            <h1 className="text-h1">{t("title")}</h1>
            <p className="text-body text-muted-foreground">
                {t("description")}
            </p>
            <p className="font-mono text-body text-muted-foreground">
                {t("openSource", { license: PLOTOPS_LICENSE })}
            </p>
            <Button
                className="w-fit min-w-0 max-w-full shrink self-start whitespace-normal"
                nativeButton={false}
                render={
                    <a
                        href={PLOTOPS_GITHUB_URL}
                        rel="noreferrer"
                        target="_blank"
                    />
                }
            >
                {t("viewOnGitHub")}
                <ExternalLink data-icon="inline-end" />
            </Button>
            <LegalFooterLinks className="justify-start text-meta text-muted-foreground" />
        </div>
    );
}
