import privacyPolicyEn from "../../../../docs/legal/privacy-policy-en.md?raw";
import privacyPolicyRu from "../../../../docs/legal/privacy-policy-ru.md?raw";
import userAgreementEn from "../../../../docs/legal/user-agreement-en.md?raw";
import userAgreementRu from "../../../../docs/legal/user-agreement-ru.md?raw";

export const LEGAL_DOCUMENT_IDS = ["terms", "privacy"] as const;

export type LegalDocument = {
    id: LegalDocumentId;
    source: string;
};

export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

export type LegalLocale = "en" | "ru";

const LEGAL_DOCUMENTS: Record<
    LegalLocale,
    Record<LegalDocumentId, LegalDocument>
> = {
    en: {
        privacy: {
            id: "privacy",
            source: privacyPolicyEn,
        },
        terms: {
            id: "terms",
            source: userAgreementEn,
        },
    },
    ru: {
        privacy: {
            id: "privacy",
            source: privacyPolicyRu,
        },
        terms: {
            id: "terms",
            source: userAgreementRu,
        },
    },
};

export function getLegalDocument(
    id: LegalDocumentId,
    locale: LegalLocale = "ru"
): LegalDocument {
    return LEGAL_DOCUMENTS[locale][id];
}

export function resolveLegalLocale(language: string): LegalLocale {
    return language.startsWith("en") ? "en" : "ru";
}
