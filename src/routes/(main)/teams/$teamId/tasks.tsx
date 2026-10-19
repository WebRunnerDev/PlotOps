import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasMainAppAccess } from "@/features/guest-mode";
import { TeamTasksPage } from "@/widgets/team-tasks";

export const Route = createFileRoute("/(main)/teams/$teamId/tasks")({
    beforeLoad: ({ context }) => {
        if (!hasMainAppAccess(Boolean(context.auth.user))) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: TeamTasksRoute,
});

function TeamTasksRoute() {
    const { teamId } = Route.useParams();
    return <TeamTasksPage teamId={teamId} />;
}
