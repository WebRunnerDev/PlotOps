import { createFileRoute } from "@tanstack/react-router";

import { parseSprintsPageSearch, SprintsPage } from "@/features/sprints";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId/sprints/"
)({
    component: BoardSprintsRoute,
    validateSearch: parseSprintsPageSearch,
});

function BoardSprintsRoute() {
    const { boardId, projectId } = Route.useParams();
    const { view } = Route.useSearch();

    return (
        <SprintsPage
            boardId={boardId}
            projectId={projectId}
            view={view ?? "sprints"}
        />
    );
}
