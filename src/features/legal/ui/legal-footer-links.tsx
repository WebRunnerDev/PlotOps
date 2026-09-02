import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";

const footerLinkClassName =
    "underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type LegalFooterLinksProperties = {
    className?: string;
    /** Shorter labels for the auth shell footer row */
    compact?: boolean;
};

export function LegalFooterLinks({
    className,
    compact = false,
}: LegalFooterLinksProperties) {
    const { t } = useTranslation("legal");
    const termsLabel = compact ? t("termsCompact") : t("terms");
    const privacyLabel = compact ? t("privacyCompact") : t("privacy");

    return (
        <nav
            aria-label={t("navLabel")}
            className={cn(
                "inline-flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1",
                className
            )}
        >
            <Link className={footerLinkClassName} to="/terms">
                {termsLabel}
            </Link>
            <span aria-hidden="true">·</span>
            <Link className={footerLinkClassName} to="/privacy">
                {privacyLabel}
            </Link>
        </nav>
    );
}
