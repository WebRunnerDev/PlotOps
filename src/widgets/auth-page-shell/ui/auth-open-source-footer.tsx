import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LegalFooterLinks } from "@/features/legal";
import {
    PLOTOPS_GITHUB_URL,
    PLOTOPS_LICENSE,
} from "@/shared/config/open-source";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

type AuthOpenSourceFooterProperties = {
    className?: string;
};

/** MIT + GitHub line for the auth shell — not an OAuth control. */
export function AuthOpenSourceFooter({
    className,
}: AuthOpenSourceFooterProperties) {
    const { t } = useTranslation("auth");

    return (
        <footer
            className={cn(
                "flex w-full min-w-0 max-w-sm flex-wrap items-center justify-center gap-x-2 gap-y-1 px-1 text-center text-meta text-muted-foreground motion-reveal [animation-delay:640ms] lg:justify-start lg:text-left",
                className
            )}
        >
            <span className="min-w-0 wrap-break-word">
                {t("openSource.line", { license: PLOTOPS_LICENSE })}
            </span>
            <Button
                aria-label={t("openSource.githubAria")}
                className="h-auto min-w-0 px-0 text-meta text-muted-foreground hover:text-foreground"
                nativeButton={false}
                render={
                    <a
                        href={PLOTOPS_GITHUB_URL}
                        rel="noreferrer"
                        target="_blank"
                    />
                }
                size="xs"
                variant="link"
            >
                {t("openSource.github")}
                <ExternalLink data-icon="inline-end" />
            </Button>
            <span aria-hidden="true">·</span>
            <LegalFooterLinks compact />
        </footer>
    );
}
