import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/features/legal";

export const Route = createFileRoute("/privacy")({
    component: PrivacyPage,
});

function PrivacyPage() {
    return <LegalDocumentPage documentId="privacy" />;
}
