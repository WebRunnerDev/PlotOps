import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "@/widgets/kanban-board";

export const Route = createFileRoute("/(main)/projects/$projectId/")({
    component: ProjectBoardRoute,
});

function ProjectBoardRoute() {
    const { projectId } = Route.useParams();

    return <BoardPage projectId={projectId} />;
}
