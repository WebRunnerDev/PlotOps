import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "@/widgets/kanban-board";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/"
)({
    component: ProjectBoardIndexRoute,
});

function ProjectBoardIndexRoute() {
    const { boardId, projectId } = Route.useParams();

    return <BoardPage boardId={boardId} projectId={projectId} />;
}
