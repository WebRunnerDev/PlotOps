import type { TFunction } from "i18next";

import type { LegalDocumentId } from "@/features/legal/model/documents";

import {
    PLOTOPS_SITE_NAME,
    PLOTOPS_SITE_TAGLINE,
    type PlotOpsPublicPath,
} from "@/shared/config/site";

import type { PageSeo } from "./seo";

import {
    type BuildAppShellTitleOptions,
    resolveAppShellDocumentTitle,
} from "./app-shell-page";

type AuthPageSeoPath = Extract<
    PlotOpsPublicPath,
    "/" | "/sign-in" | "/sign-up"
>;

/**
 * Head for authenticated SPA routes.
 *
 * Production unknown paths fall back to `404.html` (SPA shell). Even with that
 * shell, client navigations from auth pages must reset `<title>`. Pass `labels`
 * (and entity names when known) so the tab shows the current page.
 */
export function buildAppShellSeo(
    path: string,
    options: BuildAppShellTitleOptions = {}
): PageSeo {
    return {
        description: `${PLOTOPS_SITE_NAME} — ${PLOTOPS_SITE_TAGLINE}.`,
        noindex: true,
        path,
        title: resolveAppShellDocumentTitle(path, options),
    };
}

export function buildAuthPageSeo(
    path: AuthPageSeoPath,
    titleKey: "signInTitle" | "signUpTitle",
    t: TFunction<"auth">
): PageSeo {
    return {
        description: t("marketing.seoDescription"),
        path,
        title: `${t(titleKey)} — ${PLOTOPS_SITE_NAME} · ${PLOTOPS_SITE_TAGLINE}`,
    };
}

export function buildLegalPageSeo(
    documentId: LegalDocumentId,
    t: TFunction<"legal">
): PageSeo {
    const path = documentId === "privacy" ? "/privacy" : "/terms";
    const titleKey =
        documentId === "privacy" ? "seo.privacyTitle" : "seo.termsTitle";
    const descriptionKey =
        documentId === "privacy"
            ? "seo.privacyDescription"
            : "seo.termsDescription";

    return {
        description: t(descriptionKey),
        path,
        title: `${t(titleKey)} — ${PLOTOPS_SITE_NAME} · ${PLOTOPS_SITE_TAGLINE}`,
    };
}
