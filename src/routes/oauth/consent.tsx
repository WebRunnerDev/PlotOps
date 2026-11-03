import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
    oauthConsentHref,
    parseAuthorizationId,
    PENDING_OAUTH_CONSENT_KEY,
} from "@/features/auth/lib/safe-app-redirect";
import { OAuthConsentPanel } from "@/features/auth/ui/oauth-consent-panel";
import { isGuest, leaveGuestSession } from "@/features/guest-mode";
import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";
import { safeSetItem } from "@/shared/lib/safe-storage";
import { usePageSeo } from "@/shared/lib/use-page-seo";
import { AuthPageShell } from "@/widgets/auth-page-shell";

export type OAuthConsentSearch = {
    authorization_id?: string;
};

export const Route = createFileRoute("/oauth/consent")({
    beforeLoad: ({ context, search }) => {
        if (isGuest()) {
            leaveGuestSession();
        }

        const authorizationId = parseAuthorizationId(search.authorization_id);
        if (authorizationId) {
            safeSetItem(
                "sessionStorage",
                PENDING_OAUTH_CONSENT_KEY,
                oauthConsentHref(authorizationId)
            );
        }

        if (!context.auth.user) {
            throw redirect(
                authorizationId
                    ? {
                          search: {
                              redirect: oauthConsentHref(authorizationId),
                          },
                          to: "/sign-in",
                      }
                    : { to: "/sign-in" }
            );
        }
    },
    component: OAuthConsentPage,
    validateSearch: (search: Record<string, unknown>): OAuthConsentSearch => ({
        authorization_id:
            typeof search.authorization_id === "string"
                ? search.authorization_id
                : undefined,
    }),
});

function OAuthConsentPage() {
    const { authorization_id: rawId } = Route.useSearch();
    const authorizationId = parseAuthorizationId(rawId);
    const { t } = useTranslation("auth");

    usePageSeo({
        description: t("oauthConsent.seoDescription"),
        noindex: true,
        path: "/oauth/consent",
        title: `${t("oauthConsent.title")} — ${PLOTOPS_SITE_NAME} · ${PLOTOPS_SITE_TAGLINE}`,
    });

    return (
        <AuthPageShell>
            <OAuthConsentPanel authorizationId={authorizationId} />
        </AuthPageShell>
    );
}
