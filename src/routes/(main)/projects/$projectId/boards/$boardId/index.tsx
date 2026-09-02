import { createFileRoute } from "@tanstack/react-router";

import { parseTaskBoardSearch } from "@/features/tasks/model/task-board-search";
import { BoardPage } from "@/widgets/kanban-board";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/"
)({
    component: ProjectBoardIndexRoute,
    validateSearch: parseTaskBoardSearch,
});

function ProjectBoardIndexRoute() {
    const { boardId, projectId } = Route.useParams();

    return <BoardPage boardId={boardId} projectId={projectId} />;
}
