import { createFileRoute, redirect } from "@tanstack/react-router";

import { BoardPage } from "@/widgets/kanban-board";

export const Route = createFileRoute("/(main)/projects/$projectId")({
    beforeLoad: ({ context }) => {
        if (!context.auth.user) {
            throw redirect({ to: "/sign-in" });
        }
    },
    component: ProjectBoardRoute,
});

function ProjectBoardRoute() {
    const { projectId } = Route.useParams();

    return <BoardPage projectId={projectId} />;
}
