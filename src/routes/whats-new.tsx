import { createFileRoute } from "@tanstack/react-router";

import { WhatsNewPage } from "@/features/whats-new";

export const Route = createFileRoute("/whats-new")({
    component: WhatsNewPage,
});
