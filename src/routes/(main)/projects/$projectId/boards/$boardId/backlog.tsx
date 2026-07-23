import { createFileRoute } from "@tanstack/react-router";

import { BacklogPage } from "@/features/sprints";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/backlog"
)({
    component: BoardBacklogRoute,
});

function BoardBacklogRoute() {
    const { boardId, projectId } = Route.useParams();

    return <BacklogPage boardId={boardId} projectId={projectId} />;
}
