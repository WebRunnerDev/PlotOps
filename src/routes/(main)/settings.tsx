import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    ConnectedAccountsSettings,
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
    GitHubIntegrationSettings,
    ProfileSettingsForm,
} from "@/features/auth";
import { useIsGuest } from "@/features/guest-mode";
import { TaskDrawerSettings } from "@/features/tasks";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    const { t } = useTranslation("common");
    const router = useRouter();
    const guest = useIsGuest();
    const showDemoBadge = demoAccountBadgeVisible(guest);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-y-auto px-4 py-8">
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
                <div className="flex flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                            className="shrink-0 text-muted-foreground"
                            onClick={() => router.history.back()}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <ArrowLeft data-icon="inline-start" />
                            {t("back")}
                        </Button>
                        <h1>{t("platformSettings")}</h1>
                        {showDemoBadge ? (
                            <Badge
                                className="font-mono tracking-wide uppercase"
                                title={t("guest.demoAccountHint")}
                                variant="outline"
                            >
                                {t(DEMO_ACCOUNT_BADGE_I18N_KEY)}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="text-body text-muted-foreground">
                        {guest
                            ? t("guest.demoAccountHint")
                            : t("settingsDescription")}
                    </p>
                </div>
                <TaskDrawerSettings />
                {guest ? null : (
                    <>
                        <ProfileSettingsForm />
                        <GitHubIntegrationSettings />
                        <ConnectedAccountsSettings />
                    </>
                )}
            </div>
        </div>
    );
}
