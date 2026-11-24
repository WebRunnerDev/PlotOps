import { createFileRoute } from "@tanstack/react-router";

import { SprintsPage } from "@/features/sprints";
import { parseTaskBoardSearch } from "@/features/tasks";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/sprints/"
)({
    component: BoardSprintsRoute,
    validateSearch: parseTaskBoardSearch,
});

function BoardSprintsRoute() {
    const { boardId, projectId } = Route.useParams();

    return <SprintsPage boardId={boardId} projectId={projectId} />;
}
