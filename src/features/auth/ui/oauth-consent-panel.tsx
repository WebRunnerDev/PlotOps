import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    approveOAuthAuthorization,
    denyOAuthAuthorization,
    fetchOAuthAuthorizationDetails,
    isOAuthAuthorizationDetails,
    oauthRedirectUrl,
} from "@/features/auth/api/oauth-consent-api";
import { isSafeHttpRedirect } from "@/features/auth/lib/safe-app-redirect";
import { useAuth } from "@/features/auth/model/use-auth";
import { AuthPanel } from "@/features/auth/ui/auth-panel";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type ConsentDetails = {
    clientName: string;
    clientUri: null | string;
    redirectUri: string;
    scopes: string[];
};

type OAuthConsentPanelProperties = {
    authorizationId: null | string;
};

export function OAuthConsentPanel({
    authorizationId,
}: OAuthConsentPanelProperties) {
    const { t } = useTranslation("auth");
    const { user } = useAuth();
    const [details, setDetails] = useState<ConsentDetails | null>(null);
    const [errorKey, setErrorKey] = useState<null | string>(
        authorizationId ? null : "oauthConsent.missingId"
    );
    const [isLoading, setIsLoading] = useState(Boolean(authorizationId));
    const [decision, setDecision] = useState<"allow" | "deny" | null>(null);

    const redirectToClient = useCallback((url: string) => {
        if (!isSafeHttpRedirect(url)) {
            setErrorKey("oauthConsent.unsafeRedirect");
            setIsLoading(false);
            setDecision(null);
            return;
        }
        followRedirect(url);
    }, []);

    useEffect(() => {
        if (!authorizationId) return;

        let cancelled = false;
        setIsLoading(true);
        setErrorKey(null);

        void fetchOAuthAuthorizationDetails(authorizationId)
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error || !data) {
                    setErrorKey("oauthConsent.loadError");
                    setDetails(null);
                    return;
                }
                const immediate = oauthRedirectUrl(data);
                if (immediate) {
                    redirectToClient(immediate);
                    return;
                }
                if (!isOAuthAuthorizationDetails(data)) {
                    setErrorKey("oauthConsent.loadError");
                    setDetails(null);
                    return;
                }
                setDetails(parseDetails(data));
            })
            .catch(() => {
                if (cancelled) return;
                setErrorKey("oauthConsent.loadError");
                setDetails(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [authorizationId, redirectToClient]);

    const handleDecision = async (choice: "allow" | "deny") => {
        if (!authorizationId) return;
        setErrorKey(null);
        setDecision(choice);

        try {
            const result =
                choice === "allow"
                    ? await approveOAuthAuthorization(authorizationId)
                    : await denyOAuthAuthorization(authorizationId);
            if (result.error || !result.data) {
                setErrorKey("oauthConsent.decisionError");
                setDecision(null);
                return;
            }
            const url = oauthRedirectUrl(result.data);
            if (!url) {
                setErrorKey("oauthConsent.decisionError");
                setDecision(null);
                return;
            }
            redirectToClient(url);
        } catch {
            setErrorKey("oauthConsent.decisionError");
            setDecision(null);
        }
    };

    const isActing = decision !== null;
    const clientName = details?.clientName || t("oauthConsent.clientFallback");

    return (
        <AuthPanel
            className="min-w-0"
            description={t("oauthConsent.subtitle")}
            title={t("oauthConsent.title")}
        >
            {errorKey ? (
                <Alert variant="destructive">
                    <AlertDescription>{t(errorKey)}</AlertDescription>
                </Alert>
            ) : null}

            {isLoading ? (
                <div
                    className="flex items-center justify-center py-6"
                    role="status"
                >
                    <Spinner className="size-5" />
                    <span className="sr-only">{t("oauthConsent.loading")}</span>
                </div>
            ) : null}

            {details && !isLoading ? (
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="min-w-0">
                        <p className="font-mono text-meta text-muted-foreground">
                            {t("oauthConsent.clientLabel")}
                        </p>
                        {details.clientUri &&
                        isSafeHttpRedirect(details.clientUri) ? (
                            <a
                                className="text-ui text-primary wrap-break-word underline underline-offset-2 hover:text-foreground"
                                href={details.clientUri}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                {clientName}
                            </a>
                        ) : (
                            <p className="text-ui wrap-break-word">
                                {clientName}
                            </p>
                        )}
                    </div>

                    {details.redirectUri ? (
                        <div className="min-w-0">
                            <p className="font-mono text-meta text-muted-foreground">
                                {t("oauthConsent.redirectLabel")}
                            </p>
                            <p className="font-mono text-meta wrap-break-word text-foreground">
                                {details.redirectUri}
                            </p>
                        </div>
                    ) : null}

                    {details.scopes.length > 0 ? (
                        <div className="min-w-0">
                            <p className="font-mono text-meta text-muted-foreground">
                                {t("oauthConsent.scopesLabel")}
                            </p>
                            <ul className="mt-1 list-disc pl-4 text-ui">
                                {details.scopes.map((scope) => (
                                    <li key={scope}>
                                        {t(`oauthConsent.scope.${scope}`, {
                                            defaultValue: scope,
                                        })}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {user?.email ? (
                        <p className="text-meta text-muted-foreground">
                            {t("oauthConsent.actingAs", { email: user.email })}
                        </p>
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            className="min-w-0 flex-1"
                            data-testid="oauth-consent-allow"
                            disabled={isActing}
                            onClick={() => void handleDecision("allow")}
                            size="lg"
                            type="button"
                        >
                            {decision === "allow"
                                ? t("oauthConsent.allowing")
                                : t("oauthConsent.allow")}
                        </Button>
                        <Button
                            className="min-w-0 flex-1"
                            data-testid="oauth-consent-deny"
                            disabled={isActing}
                            onClick={() => void handleDecision("deny")}
                            size="lg"
                            type="button"
                            variant="secondary"
                        >
                            {decision === "deny"
                                ? t("oauthConsent.denying")
                                : t("oauthConsent.deny")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </AuthPanel>
    );
}

function followRedirect(url: string) {
    globalThis.location.assign(url);
}

function parseDetails(data: {
    client?: { name?: string; uri?: string };
    redirect_uri?: string;
    scope?: string;
}): ConsentDetails {
    const scopes = (data.scope ?? "")
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);

    return {
        clientName: data.client?.name?.trim() || "",
        clientUri: data.client?.uri?.trim() || null,
        redirectUri: data.redirect_uri?.trim() || "",
        scopes,
    };
}
