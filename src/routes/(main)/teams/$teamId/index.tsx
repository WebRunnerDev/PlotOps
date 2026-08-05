import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasMainAppAccess } from "@/features/guest-mode";
import { TeamProjectsPage } from "@/features/teams";

export const Route = createFileRoute("/(main)/teams/$teamId/")({
    beforeLoad: ({ context }) => {
        if (!hasMainAppAccess(Boolean(context.auth.user))) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: TeamProjectsRoute,
});

function TeamProjectsRoute() {
    const { teamId } = Route.useParams();
    return <TeamProjectsPage teamId={teamId} />;
}
