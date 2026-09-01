import { useTranslation } from "react-i18next";

import {
    getLegalDocument,
    type LegalDocumentId,
    resolveLegalLocale,
} from "../model/documents";
import { LegalMarkdown } from "./legal-markdown";
import { LegalPageSeo } from "./legal-page-seo";
import { LegalPageShell } from "./legal-page-shell";

type LegalDocumentPageProperties = {
    documentId: LegalDocumentId;
};

export function LegalDocumentPage({ documentId }: LegalDocumentPageProperties) {
    const { i18n } = useTranslation();
    const document = getLegalDocument(
        documentId,
        resolveLegalLocale(i18n.language)
    );

    return (
        <>
            <LegalPageSeo documentId={documentId} />
            <LegalPageShell>
                <LegalMarkdown source={document.source} />
            </LegalPageShell>
        </>
    );
}
