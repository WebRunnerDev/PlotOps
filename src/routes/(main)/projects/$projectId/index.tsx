import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useProjectBoards } from "@/features/boards";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { BoardLoading } from "@/widgets/kanban-board/ui/board-loading";

export const Route = createFileRoute("/(main)/projects/$projectId/")({
    component: ProjectIndexRoute,
});

function ProjectIndexRoute() {
    const { projectId } = Route.useParams();
    const { t } = useTranslation("board");
    const { data: boards, error, isLoading } = useProjectBoards(projectId);
    const firstBoard = boards?.[0];

    if (firstBoard) {
        return (
            <Navigate
                params={{
                    boardId: firstBoard.id,
                    projectId,
                }}
                replace
                to="/projects/$projectId/boards/$boardId"
            />
        );
    }

    if (isLoading) {
        return <BoardLoading />;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <Alert variant="destructive">
                <AlertDescription>
                    {error ? t("projectError") : t("loadingBoardEmpty")}
                </AlertDescription>
            </Alert>
        </div>
    );
}
