import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
    getIdentityActionErrorKey,
    linkIdentityWithGitHub,
    linkIdentityWithGoogle,
    unlinkAuthIdentity,
} from "@/features/auth/api/auth-api";
import { canUnlinkIdentity } from "@/features/auth/lib/can-unlink-identity";
import {
    type AuthSignInProvider,
    deriveSignInProviderSlots,
    type SignInProviderSlot,
} from "@/features/auth/lib/connected-providers";
import { clearGitHubAccessToken } from "@/features/auth/model/github-token";
import { useAuth } from "@/features/auth/model/use-auth";
import { AuthProviderIcon } from "@/features/auth/ui/auth-provider-icon";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";

export function ConnectedAccountsSettings() {
    const { t } = useTranslation("auth");
    const { user } = useAuth();
    const [actionLoading, setActionLoading] =
        useState<AuthSignInProvider | null>(null);
    const [error, setError] = useState<null | string>(null);

    const providerSlots = useMemo(
        () => (user ? deriveSignInProviderSlots(user) : []),
        [user]
    );

    const identities = user?.identities ?? [];
    const unlinkAllowed = canUnlinkIdentity(identities);

    if (!user || providerSlots.length === 0) {
        return null;
    }

    const handleConnect = async (provider: "github" | "google") => {
        setError(null);
        setActionLoading(provider);

        const { error: linkError } =
            provider === "github"
                ? await linkIdentityWithGitHub()
                : await linkIdentityWithGoogle();

        if (linkError) {
            setActionLoading(null);
            setError(t(getIdentityActionErrorKey(linkError)));
        }
    };

    const handleDisconnect = async (slot: SignInProviderSlot) => {
        setError(null);

        if (!slot.identity) {
            setError(t("errors.generic"));
            return;
        }

        if (!unlinkAllowed) {
            setError(t("settings.cannotUnlinkLastMethod"));
            return;
        }

        setActionLoading(slot.provider);

        if (slot.provider === "github") {
            clearGitHubAccessToken();
        }

        const { error: unlinkError } = await unlinkAuthIdentity(slot.identity);

        setActionLoading(null);

        if (unlinkError) {
            setError(t(getIdentityActionErrorKey(unlinkError)));
            return;
        }

        toast.success(t("settings.disconnected"));
    };

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle>{t("settings.connectedAccountsTitle")}</CardTitle>
                <CardDescription>
                    {t("settings.connectedAccountsDescription")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error ? (
                    <Alert className="mb-4" variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <ul className="divide-y divide-border rounded-lg border border-border">
                    {providerSlots.map((slot) => (
                        <li
                            className="flex min-w-0 items-center gap-3 px-3 py-3"
                            key={slot.provider}
                        >
                            <AuthProviderIcon provider={slot.provider} />
                            <div className="min-w-0 flex-1">
                                <p className="font-medium">
                                    {t(`settings.providers.${slot.provider}`)}
                                </p>
                                {slot.identifier ? (
                                    <p className="truncate font-mono text-meta text-muted-foreground">
                                        {slot.identifier}
                                    </p>
                                ) : null}
                            </div>
                            {slot.connected ? (
                                <Button
                                    className="shrink-0"
                                    disabled={
                                        actionLoading !== null || !unlinkAllowed
                                    }
                                    onClick={() => handleDisconnect(slot)}
                                    size="sm"
                                    title={
                                        unlinkAllowed
                                            ? undefined
                                            : t(
                                                  "settings.cannotUnlinkLastMethod"
                                              )
                                    }
                                    type="button"
                                    variant="outline"
                                >
                                    {actionLoading === slot.provider
                                        ? t("settings.disconnecting")
                                        : t("settings.disconnect")}
                                </Button>
                            ) : (
                                <Button
                                    className="shrink-0"
                                    disabled={actionLoading !== null}
                                    onClick={() => {
                                        if (
                                            slot.provider === "github" ||
                                            slot.provider === "google"
                                        ) {
                                            handleConnect(slot.provider);
                                        }
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {actionLoading === slot.provider
                                        ? t("settings.connecting")
                                        : t("settings.connect")}
                                </Button>
                            )}
                            {slot.connected ? (
                                <Badge
                                    className="hidden shrink-0 sm:inline-flex"
                                    variant="secondary"
                                >
                                    {t("settings.connectedStatus")}
                                </Badge>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
