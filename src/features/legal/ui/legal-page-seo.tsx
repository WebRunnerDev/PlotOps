import { useTranslation } from "react-i18next";

import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";
import { usePageSeo } from "@/shared/lib/use-page-seo";

import type { LegalDocumentId } from "../model/documents";

type LegalPageSeoProperties = {
    documentId: LegalDocumentId;
};

export function LegalPageSeo({ documentId }: LegalPageSeoProperties) {
    const { t } = useTranslation("legal");
    const path = documentId === "privacy" ? "/privacy" : "/terms";
    const titleKey =
        documentId === "privacy" ? "seo.privacyTitle" : "seo.termsTitle";
    const descriptionKey =
        documentId === "privacy"
            ? "seo.privacyDescription"
            : "seo.termsDescription";

    usePageSeo({
        description: t(descriptionKey),
        path,
        title: `${t(titleKey)} — ${PLOTOPS_SITE_NAME} · ${PLOTOPS_SITE_TAGLINE}`,
    });

    return null;
}
