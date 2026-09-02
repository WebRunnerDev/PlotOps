import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/features/legal";

export const Route = createFileRoute("/terms")({
    component: TermsPage,
});

function TermsPage() {
    return <LegalDocumentPage documentId="terms" />;
}
