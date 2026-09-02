import type { TFunction } from "i18next";

import type { LegalDocumentId } from "@/features/legal/model/documents";

import {
    PLOTOPS_SITE_NAME,
    PLOTOPS_SITE_TAGLINE,
    type PlotOpsPublicPath,
} from "@/shared/config/site";

import type { PageSeo } from "./seo";

type AuthPageSeoPath = Extract<
    PlotOpsPublicPath,
    "/" | "/sign-in" | "/sign-up"
>;

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
