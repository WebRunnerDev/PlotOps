import { createFileRoute, redirect } from "@tanstack/react-router";

import { TeamProjectsPage } from "@/features/teams";

export const Route = createFileRoute("/(main)/teams/$teamId/")({
    beforeLoad: ({ context }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: TeamProjectsRoute,
});

function TeamProjectsRoute() {
    const { teamId } = Route.useParams();
    return <TeamProjectsPage teamId={teamId} />;
}
