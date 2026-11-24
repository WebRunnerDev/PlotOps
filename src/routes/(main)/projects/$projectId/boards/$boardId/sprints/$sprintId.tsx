import { createFileRoute } from "@tanstack/react-router";

import { SprintReportPage } from "@/features/sprints";
import { parseTaskBoardSearch } from "@/features/tasks";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/sprints/$sprintId"
)({
    component: BoardSprintReportRoute,
    validateSearch: parseTaskBoardSearch,
});

function BoardSprintReportRoute() {
    const { boardId, projectId, sprintId } = Route.useParams();

    return (
        <SprintReportPage
            boardId={boardId}
            projectId={projectId}
            sprintId={sprintId}
        />
    );
}
