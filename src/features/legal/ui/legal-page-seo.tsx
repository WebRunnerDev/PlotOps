import { useTranslation } from "react-i18next";

import { buildLegalPageSeo } from "@/shared/lib/page-seo-config";
import { usePageSeo } from "@/shared/lib/use-page-seo";

import type { LegalDocumentId } from "../model/documents";

type LegalPageSeoProperties = {
    documentId: LegalDocumentId;
};

export function LegalPageSeo({ documentId }: LegalPageSeoProperties) {
    const { t } = useTranslation("legal");

    usePageSeo(buildLegalPageSeo(documentId, t));

    return null;
}
