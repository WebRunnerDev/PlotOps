import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasMainAppAccess } from "@/features/guest-mode";
import { TeamsPage } from "@/features/teams";

export const Route = createFileRoute("/(main)/home")({
    beforeLoad: ({ context }) => {
        if (!hasMainAppAccess(Boolean(context.auth.user))) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: TeamsPage,
});
