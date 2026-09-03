import { createFileRoute } from "@tanstack/react-router";
import {
    Bell,
    Columns3,
    Command,
    ExternalLink,
    GitBranch,
    Layers,
    type LucideIcon,
    PlayCircle,
    Users,
    Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { LegalFooterLinks } from "@/features/legal";
import {
    PLOTOPS_GITHUB_URL,
    PLOTOPS_LICENSE,
} from "@/shared/config/open-source";
import { Button } from "@/shared/shadcn/ui/button";
import { Separator } from "@/shared/shadcn/ui/separator";

export const Route = createFileRoute("/(main)/about")({
    component: AboutPage,
});

const FEATURES = [
    { icon: Columns3, key: "kanban" },
    { icon: GitBranch, key: "git" },
    { icon: Workflow, key: "cicd" },
    { icon: Layers, key: "sprints" },
    { icon: Users, key: "teams" },
    { icon: Bell, key: "collaboration" },
    { icon: Command, key: "palette" },
    { icon: PlayCircle, key: "guest" },
] as const satisfies ReadonlyArray<{
    icon: LucideIcon;
    key: string;
}>;

function AboutPage() {
    const { t } = useTranslation("about");

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8 wrap-break-word py-8">
            <header className="flex min-w-0 flex-col gap-3">
                <h1 className="text-h1">{t("title")}</h1>
                <p className="text-body text-muted-foreground">
                    {t("description")}
                </p>
            </header>

            <section
                aria-labelledby="about-features-heading"
                className="flex min-w-0 flex-col gap-4"
            >
                <h2 className="text-h2" id="about-features-heading">
                    {t("featuresTitle")}
                </h2>
                <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {FEATURES.map(({ icon: Icon, key }) => (
                        <li
                            className="flex min-w-0 flex-col gap-2 rounded-sm border border-border p-4"
                            key={key}
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <Icon
                                    aria-hidden
                                    className="size-4 shrink-0 text-primary"
                                />
                                <h3 className="min-w-0 text-h3 wrap-break-word">
                                    {t(`features.${key}.title`)}
                                </h3>
                            </div>
                            <p className="text-ui text-muted-foreground wrap-break-word">
                                {t(`features.${key}.body`)}
                            </p>
                        </li>
                    ))}
                </ul>
            </section>

            <section
                aria-labelledby="about-stack-heading"
                className="flex min-w-0 flex-col gap-2"
            >
                <h2 className="text-h2" id="about-stack-heading">
                    {t("stackTitle")}
                </h2>
                <p className="text-body text-muted-foreground">{t("stack")}</p>
            </section>

            <Separator />

            <footer className="flex min-w-0 flex-col gap-4">
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
            </footer>
        </div>
    );
}
