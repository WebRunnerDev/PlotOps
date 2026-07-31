import { GitBranch } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import { BoardSwitcher, useProjectBoards } from "@/features/boards";
import { buildGithubTreeUrl } from "@/features/projects/model/github-project-links";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { BoardSprintControls } from "@/features/sprints";
import { BoardArchiveDialog } from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";

import { BoardLoading } from "./board-loading";
import { KanbanBoard } from "./kanban-board";

type BoardPageProperties = {
    boardId: string;
    projectId: string;
};

export function BoardPage({ boardId, projectId }: BoardPageProperties) {
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { data: project, error, isLoading } = useProject(projectId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const {
        canManageBoard,
        isError: accessError,
        isSettled,
    } = useProjectAccess(projectId);
    const currentBoard = boards.find((board) => board.id === boardId);
    const baseBranch: string =
        currentBoard?.baseBranch ?? project?.github_default_branch ?? "main";
    const branchUrl = buildGithubTreeUrl(project?.github_html_url, baseBranch);

    if (isLoading) {
        return <BoardLoading />;
    }

    if (error || !project) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const branchLabel = (
        <>
            <GitBranch aria-hidden className="size-3.5" />
            {baseBranch}
        </>
    );

    return (
        <div className="@container/board scrollbar-board h-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full flex-col gap-3 pt-2">
                <header className="sticky left-0 z-10 w-[100cqw] shrink-0 border-b border-border bg-background/95 px-12 py-2 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        {branchUrl ? (
                            <a
                                className="inline-flex items-center gap-1.5 text-code text-muted-foreground hover:text-foreground hover:underline"
                                href={branchUrl}
                                rel="noreferrer noopener"
                                target="_blank"
                            >
                                {branchLabel}
                            </a>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-code text-muted-foreground">
                                {branchLabel}
                            </span>
                        )}
                        <BoardSwitcher
                            boardId={boardId}
                            canManage={isSettled && canManageBoard}
                            defaultBaseBranch={
                                project.github_default_branch ?? "main"
                            }
                            projectId={projectId}
                        />
                        <BoardSprintControls
                            boardId={boardId}
                            projectId={projectId}
                        />
                        <BoardArchiveDialog
                            boardId={boardId}
                            projectId={projectId}
                        />
                    </div>
                    {accessError ? (
                        <Alert className="mt-2" variant="destructive">
                            <AlertDescription>
                                {t("projectError")}
                            </AlertDescription>
                        </Alert>
                    ) : undefined}
                </header>

                <div className="min-h-0 min-w-0 flex-1 px-12">
                    <KanbanBoard
                        boardId={boardId}
                        githubToken={githubAccessToken}
                        projectId={projectId}
                        repoFullName={project.github_full_name ?? undefined}
                    />
                </div>
            </div>
        </div>
    );
}
