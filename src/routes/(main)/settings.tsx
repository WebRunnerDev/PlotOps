import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
    ProfileSettingsForm,
} from "@/features/auth";
import { useIsGuest } from "@/features/guest-mode";
import { Badge } from "@/shared/shadcn/ui/badge";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    const { t } = useTranslation("common");
    const guest = useIsGuest();
    const showDemoBadge = demoAccountBadgeVisible(guest);

    return (
        <div className="flex flex-col gap-6 py-8">
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
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
            {guest ? null : <ProfileSettingsForm />}
        </div>
    );
}
