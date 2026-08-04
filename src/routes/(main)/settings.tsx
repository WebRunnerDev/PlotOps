import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
    isGuestSession,
    ProfileSettingsForm,
    useAuth,
} from "@/features/auth";
import { Badge } from "@/shared/shadcn/ui/badge";

export const Route = createFileRoute("/(main)/settings")({
    component: SettingsPage,
});

function SettingsPage() {
    const { t } = useTranslation("common");
    const { user } = useAuth();
    const showDemoBadge = demoAccountBadgeVisible(isGuestSession(user));

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
                    {t("settingsDescription")}
                </p>
                {showDemoBadge ? (
                    <p className="text-ui text-muted-foreground">
                        {t("guest.demoAccountHint")}
                    </p>
                ) : null}
            </div>
            <ProfileSettingsForm />
        </div>
    );
}
