import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

type AuthMarketingIntroProperties = {
    className?: string;
};

/** Brand-first pitch — PlotOps is the hero signal, not an eyebrow. */
export function AuthMarketingIntro({
    className,
}: AuthMarketingIntroProperties) {
    const { t } = useTranslation("auth");

    return (
        <header
            className={cn(
                "flex w-full min-w-0 max-w-xl flex-col gap-5 text-left sm:gap-6 lg:max-w-none",
                className
            )}
        >
            <p className="font-mono text-meta text-primary uppercase tracking-[0.14em] motion-reveal [animation-delay:80ms]">
                {t("marketing.eyebrow")}
            </p>

            <div className="flex min-w-0 flex-col gap-4">
                <h1 className="text-display text-foreground motion-reveal [animation-delay:160ms]">
                    PlotOps
                </h1>
                <div
                    aria-hidden
                    className="h-px w-14 bg-primary/70 motion-reveal [animation-delay:200ms]"
                />
                <p className="max-w-[16ch] text-h1 text-foreground/90 wrap-break-word motion-reveal [animation-delay:240ms]">
                    {t("marketing.title")}
                </p>
                <p className="max-w-md text-body text-muted-foreground wrap-break-word motion-reveal [animation-delay:320ms]">
                    {t("marketing.description")}
                </p>
            </div>

            <ul className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 font-mono text-meta text-muted-foreground motion-reveal [animation-delay:400ms]">
                <li className="min-w-0 wrap-break-word">
                    {t("marketing.features.kanban")}
                </li>
                <li aria-hidden className="text-primary/50">
                    /
                </li>
                <li className="min-w-0 wrap-break-word">
                    {t("marketing.features.git")}
                </li>
                <li aria-hidden className="text-primary/50">
                    /
                </li>
                <li className="min-w-0 wrap-break-word">
                    {t("marketing.features.ci")}
                </li>
            </ul>
        </header>
    );
}
