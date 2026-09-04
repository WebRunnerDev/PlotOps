import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    getIdentityActionErrorKey,
    linkIdentityWithGitHub,
    signInWithGitHub,
} from "@/features/auth/api/auth-api";
import { fetchGitHubAuthenticatedUser } from "@/features/auth/lib/fetch-github-authenticated-user";
import {
    githubIdentityFromUser,
    hasGitHubIdentity,
} from "@/features/auth/lib/resolve-github-profile-fields";
import { validateGitHubAccessToken } from "@/features/auth/model/github-token";
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

type GitHubTokenStatus = "checking" | "expired" | "missing" | "valid";

export function GitHubIntegrationSettings() {
    const { t } = useTranslation("auth");
    const { githubAccessToken, profile, user } = useAuth();
    const [tokenStatus, setTokenStatus] =
        useState<GitHubTokenStatus>("checking");
    const [githubLogin, setGithubLogin] = useState("");
    const [reconnecting, setReconnecting] = useState(false);
    const [error, setError] = useState<null | string>(null);

    const githubLinked = user ? hasGitHubIdentity(user) : false;
    const googleOnly = Boolean(user && !githubLinked);

    useEffect(() => {
        if (!user) return;

        const fromProfile = profile?.github_login?.trim() ?? "";
        const fromIdentity =
            githubIdentityFromUser(user).github_login?.trim() ?? "";

        if (fromProfile || fromIdentity) {
            setGithubLogin(fromProfile || fromIdentity);
            return;
        }

        if (!githubAccessToken) {
            setGithubLogin("");
            return;
        }

        let cancelled = false;

        void fetchGitHubAuthenticatedUser(githubAccessToken).then((apiUser) => {
            if (cancelled) return;
            setGithubLogin(apiUser?.login ?? "");
        });

        return () => {
            cancelled = true;
        };
    }, [githubAccessToken, profile?.github_login, user]);

    useEffect(() => {
        if (!githubAccessToken) {
            setTokenStatus("missing");
            return;
        }

        let cancelled = false;
        setTokenStatus("checking");

        void validateGitHubAccessToken(githubAccessToken).then((valid) => {
            if (cancelled) return;
            setTokenStatus(valid ? "valid" : "expired");
        });

        return () => {
            cancelled = true;
        };
    }, [githubAccessToken]);

    if (!user) {
        return null;
    }

    const showReconnect =
        googleOnly || tokenStatus === "missing" || tokenStatus === "expired";

    const handleReconnect = async () => {
        setError(null);
        setReconnecting(true);

        if (googleOnly) {
            const { error: linkError } = await linkIdentityWithGitHub();

            if (linkError) {
                setReconnecting(false);
                setError(t(getIdentityActionErrorKey(linkError)));
            }

            return;
        }

        void signInWithGitHub();
    };

    const tokenStatusBadgeVariant =
        tokenStatus === "valid"
            ? "secondary"
            : tokenStatus === "checking"
              ? "outline"
              : "destructive";

    return (
        <Card className="max-w-none rounded-none border border-border bg-card/60 shadow-none ring-1 ring-primary/15 backdrop-blur-sm">
            <CardHeader className="gap-3 border-b border-border/80 pb-4">
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                        03
                    </p>
                    <CardTitle>
                        {t("settings.githubIntegration.title")}
                    </CardTitle>
                    <div aria-hidden className="h-px w-10 bg-primary/60" />
                    <CardDescription>
                        {t("settings.githubIntegration.description")}{" "}
                        {t("settings.githubIntegration.connectedAccountsHint")}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-5">
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {googleOnly ? (
                    <Alert>
                        <AlertDescription>
                            {t(
                                "settings.githubIntegration.googleOnlyExplanation"
                            )}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="divide-y divide-border border border-border">
                    <div className="flex min-w-0 items-center gap-3 px-3.5 py-3 transition-colors duration-300 ease-(--ease-out-expo) hover:bg-muted/35">
                        <AuthProviderIcon provider="github" />
                        <div className="min-w-0 flex-1">
                            <p className="font-medium">
                                {t(
                                    "settings.githubIntegration.githubLoginLabel"
                                )}
                            </p>
                            <p className="truncate font-mono text-meta text-muted-foreground normal-case tracking-normal">
                                {githubLogin ||
                                    t(
                                        "settings.githubIntegration.githubLoginMissing"
                                    )}
                            </p>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-3 transition-colors duration-300 ease-(--ease-out-expo) hover:bg-muted/35">
                        <div className="min-w-0">
                            <p className="font-medium">
                                {t(
                                    "settings.githubIntegration.tokenStatusLabel"
                                )}
                            </p>
                            <p className="text-meta text-muted-foreground normal-case tracking-normal">
                                {t(
                                    "settings.githubIntegration.tokenStatusHint"
                                )}
                            </p>
                        </div>
                        <Badge
                            className="shrink-0 font-mono tracking-wide uppercase"
                            variant={tokenStatusBadgeVariant}
                        >
                            {t(
                                `settings.githubIntegration.tokenStatus.${tokenStatus}`
                            )}
                        </Badge>
                    </div>
                </div>

                {showReconnect ? (
                    <Button
                        className="self-start"
                        disabled={reconnecting || tokenStatus === "checking"}
                        onClick={() => {
                            void handleReconnect();
                        }}
                        type="button"
                        variant="outline"
                    >
                        {reconnecting
                            ? t("settings.githubIntegration.reconnecting")
                            : t("settings.githubIntegration.reconnectGitHub")}
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}
