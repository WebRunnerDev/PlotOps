import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

type AuthMarketingIntroProperties = {
    className?: string;
};

/** Visible product pitch on auth pages — helps visitors and search crawlers. */
export function AuthMarketingIntro({
    className,
}: AuthMarketingIntroProperties) {
    const { t } = useTranslation("auth");

    return (
        <header
            className={cn(
                "mx-auto flex w-full min-w-0 max-w-lg flex-col items-center gap-3 text-center",
                className
            )}
        >
            <img
                alt=""
                className="size-16 shrink-0 rounded-sm border border-border"
                height={64}
                src="/PlotOps.png"
                width={64}
            />
            <div className="flex min-w-0 flex-col gap-2">
                <p className="font-mono text-meta text-primary uppercase tracking-wider">
                    {t("marketing.eyebrow")}
                </p>
                <h1 className="text-h2 wrap-break-word">
                    {t("marketing.title")}
                </h1>
                <p className="text-body text-muted-foreground wrap-break-word">
                    {t("marketing.description")}
                </p>
            </div>
            <ul className="grid w-full min-w-0 gap-2 text-left text-meta text-muted-foreground sm:grid-cols-3">
                <li className="min-w-0 rounded-sm border border-border px-3 py-2 wrap-break-word">
                    {t("marketing.features.kanban")}
                </li>
                <li className="min-w-0 rounded-sm border border-border px-3 py-2 wrap-break-word">
                    {t("marketing.features.git")}
                </li>
                <li className="min-w-0 rounded-sm border border-border px-3 py-2 wrap-break-word">
                    {t("marketing.features.ci")}
                </li>
            </ul>
        </header>
    );
}
