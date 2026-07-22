import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/boards/$boardId"
)({
    component: ProjectBoardLayout,
});

function ProjectBoardLayout() {
    return <Outlet />;
}
