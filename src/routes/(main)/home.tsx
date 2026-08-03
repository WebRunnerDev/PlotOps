import { createFileRoute, redirect } from "@tanstack/react-router";

import { TeamsPage } from "@/features/teams";

export const Route = createFileRoute("/(main)/home")({
    beforeLoad: ({ context }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: TeamsPage,
});
