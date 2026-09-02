import { createFileRoute } from "@tanstack/react-router";

import { BacklogPage } from "@/features/sprints";
import { parseTaskBoardSearch } from "@/features/tasks/model/task-board-search";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/backlog"
)({
    component: BoardBacklogRoute,
    validateSearch: parseTaskBoardSearch,
});

function BoardBacklogRoute() {
    const { boardId, projectId } = Route.useParams();

    return <BacklogPage boardId={boardId} projectId={projectId} />;
}
