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

const PILLAR_KEYS = new Set(["cicd", "git", "kanban"]);

function AboutPage() {
    const { t } = useTranslation("about");
    const pillars = FEATURES.filter((feature) => PILLAR_KEYS.has(feature.key));
    const also = FEATURES.filter((feature) => !PILLAR_KEYS.has(feature.key));

    return (
        <div className="relative mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-20 wrap-break-word py-8 sm:gap-24 sm:py-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-80 bg-auth-atmosphere opacity-90 sm:-top-12 sm:h-112"
            />

            <header className="relative flex min-w-0 max-w-2xl flex-col gap-5 motion-reveal sm:gap-6">
                <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                    {t("title")}
                </p>
                <h1 className="text-display text-foreground">PlotOps</h1>
                <div aria-hidden className="h-px w-14 bg-primary/70" />
                <p className="max-w-[16ch] text-h1 text-foreground/90">
                    {t("tagline")}
                </p>
                <p className="max-w-xl text-body text-muted-foreground">
                    {t("description")}
                </p>
            </header>

            <section
                aria-labelledby="about-pillars-heading"
                className="relative flex min-w-0 flex-col gap-10"
            >
                <div className="flex min-w-0 flex-col gap-2 motion-reveal [animation-delay:100ms]">
                    <h2 className="text-h2" id="about-pillars-heading">
                        {t("pillarsTitle")}
                    </h2>
                    <div aria-hidden className="h-px w-16 bg-primary/60" />
                </div>

                <ul className="flex min-w-0 flex-col gap-12 sm:gap-16">
                    {pillars.map(({ icon: Icon, key }, index) => (
                        <li
                            className="group motion-reveal grid min-w-0 gap-4 border-t border-border pt-8 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-10 sm:pt-10"
                            key={key}
                            style={{
                                animationDelay: `${180 + index * 100}ms`,
                            }}
                        >
                            <span className="font-heading text-[clamp(2.5rem,1rem+4vw,4.5rem)] font-bold leading-none tracking-[-0.045em] text-primary/35 tabular-nums transition-colors duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:text-primary/55">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <Icon
                                        aria-hidden
                                        className="size-4 shrink-0 text-primary transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-0.5"
                                    />
                                    <h3 className="min-w-0 text-h2 wrap-break-word">
                                        {t(`features.${key}.title`)}
                                    </h3>
                                </div>
                                <p className="max-w-xl text-body text-muted-foreground wrap-break-word">
                                    {t(`features.${key}.body`)}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section
                aria-labelledby="about-features-heading"
                className="relative flex min-w-0 flex-col gap-6"
            >
                <div className="flex min-w-0 flex-col gap-2 motion-reveal [animation-delay:480ms]">
                    <h2 className="text-h2" id="about-features-heading">
                        {t("featuresTitle")}
                    </h2>
                    <div aria-hidden className="h-px w-16 bg-primary/60" />
                </div>

                <ul className="flex min-w-0 flex-col border-t border-border">
                    {also.map(({ icon: Icon, key }, index) => (
                        <li
                            className="group motion-reveal grid min-w-0 gap-2 border-b border-border py-4 sm:grid-cols-[3.5rem_minmax(0,10rem)_minmax(0,1fr)] sm:items-baseline sm:gap-5 sm:py-5"
                            key={key}
                            style={{
                                animationDelay: `${520 + index * 50}ms`,
                            }}
                        >
                            <span className="font-mono text-meta text-primary/80 tabular-nums">
                                {String(index + 4).padStart(2, "0")}
                            </span>
                            <div className="flex min-w-0 items-center gap-2">
                                <Icon
                                    aria-hidden
                                    className="size-3.5 shrink-0 text-primary transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-0.5"
                                />
                                <h3 className="min-w-0 text-h3 wrap-break-word">
                                    {t(`features.${key}.title`)}
                                </h3>
                            </div>
                            <p className="min-w-0 text-ui text-muted-foreground wrap-break-word sm:pt-0.5">
                                {t(`features.${key}.body`)}
                            </p>
                        </li>
                    ))}
                </ul>
            </section>

            <section
                aria-labelledby="about-stack-heading"
                className="relative flex min-w-0 flex-col gap-3 motion-reveal [animation-delay:760ms] sm:max-w-lg sm:self-end sm:text-right"
            >
                <h2 className="text-h2" id="about-stack-heading">
                    {t("stackTitle")}
                </h2>
                <p className="font-mono text-code text-muted-foreground wrap-break-word">
                    {t("stack")}
                </p>
            </section>

            <footer className="relative flex min-w-0 flex-col gap-5 border-t border-border pt-8 motion-reveal [animation-delay:880ms]">
                <p className="font-mono text-meta text-muted-foreground">
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
