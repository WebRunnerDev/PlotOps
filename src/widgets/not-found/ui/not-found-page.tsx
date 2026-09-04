import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import { CommandPalette } from "@/features/command-palette";
import { hasMainAppAccess } from "@/features/guest-mode";
import { Button } from "@/shared/shadcn/ui/button";
import { TopBar } from "@/widgets/top-bar";

import { resolveNotFoundCta } from "../model/resolve-not-found-cta";

export function NotFoundPage() {
    const { t } = useTranslation("common");
    const { user } = useAuth();
    const inApp = hasMainAppAccess(Boolean(user));
    const cta = resolveNotFoundCta(inApp);

    const content = (
        <div className="flex flex-col items-center justify-center gap-6 px-4 py-16 text-center sm:py-24">
            <p
                aria-hidden
                className="font-mono text-[clamp(4.5rem,18vw,9rem)] font-medium leading-none tracking-tighter text-foreground"
            >
                404
            </p>
            <div className="flex max-w-md flex-col gap-2">
                <h1 className="text-h1">{t("notFound.title")}</h1>
                <p className="text-body text-muted-foreground">
                    {t("notFound.description")}
                </p>
            </div>
            <Button
                nativeButton={false}
                render={<Link to={cta.to} />}
                size="lg"
            >
                {t(cta.labelKey)}
            </Button>
        </div>
    );

    if (!inApp) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center [view-transition-name:main-content]">
                {content}
            </div>
        );
    }

    return (
        <div className="min-h-dvh">
            <TopBar />
            <CommandPalette />
            <div className="mx-auto w-full max-w-5xl p-4 [view-transition-name:main-content]">
                {content}
            </div>
        </div>
    );
}
