import type { ReactNode } from "react";

import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePrerenderReady } from "@/shared/lib/use-prerender-ready";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

import { LegalFooterLinks } from "./legal-footer-links";

type LegalPageShellProperties = {
    children: ReactNode;
    className?: string;
};

export function LegalPageShell({
    children,
    className,
}: LegalPageShellProperties) {
    usePrerenderReady();
    const router = useRouter();
    const { t } = useTranslation(["legal", "common"]);

    const handleBack = () => {
        if (globalThis.history.length > 1) {
            router.history.back();
            return;
        }
        void router.navigate({ to: "/sign-in" });
    };

    return (
        <div
            className={cn(
                "mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12",
                className
            )}
        >
            <Button
                className="w-fit min-w-0 self-start"
                onClick={handleBack}
                size="sm"
                type="button"
                variant="ghost"
            >
                <ArrowLeft data-icon="inline-start" />
                {t("common:back")}
            </Button>
            {children}
            <LegalFooterLinks className="border-border border-t pt-6 text-meta text-muted-foreground" />
        </div>
    );
}
