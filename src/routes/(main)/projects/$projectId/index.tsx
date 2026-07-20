import { createFileRoute, redirect } from "@tanstack/react-router";

import { fetchProjectBoards } from "@/features/tasks/api/boards-api";

export const Route = createFileRoute("/(main)/projects/$projectId/")({
    beforeLoad: async ({ params }) => {
        const boards = await fetchProjectBoards(params.projectId);
        const first = boards[0];
        if (!first) {
            throw new Error("Project has no boards");
        }
        throw redirect({
            params: {
                boardId: first.id,
                projectId: params.projectId,
            },
            to: "/projects/$projectId/boards/$boardId",
        });
    },
});
