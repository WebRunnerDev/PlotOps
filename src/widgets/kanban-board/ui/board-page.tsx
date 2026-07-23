import { Link } from "@tanstack/react-router";
import { ExternalLink, GitBranch, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import { BoardSwitcher, useProjectBoards } from "@/features/boards";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { BoardSprintControls } from "@/features/sprints";
import { BoardArchiveDialog } from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";

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
    const { canManageBoard } = useProjectAccess(projectId);
    const currentBoard = boards.find((board) => board.id === boardId);

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

    return (
        <div className="@container/board scrollbar-board h-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full flex-col gap-3 pt-2">
                <header className="sticky left-0 z-10 w-[100cqw] shrink-0 border-b border-border bg-background/95 px-12 py-2 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-baseline gap-2">
                            <h1 className="truncate text-sm font-semibold">
                                {project.name}
                            </h1>
                            {project.github_full_name ? (
                                <p className="truncate text-code text-muted-foreground">
                                    {project.github_full_name}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <BoardSwitcher
                                boardId={boardId}
                                canManage={canManageBoard}
                                defaultBaseBranch={
                                    project.github_default_branch ?? "main"
                                }
                                projectId={projectId}
                            />
                            <BoardSprintControls
                                boardId={boardId}
                                projectId={projectId}
                            />
                            <span className="inline-flex items-center gap-1.5 text-code text-muted-foreground">
                                <GitBranch aria-hidden className="size-3.5" />
                                {currentBoard?.baseBranch ??
                                    project.github_default_branch}
                            </span>
                            <BoardArchiveDialog
                                boardId={boardId}
                                projectId={projectId}
                            />
                            <Button
                                nativeButton={false}
                                render={
                                    <Link
                                        params={{ projectId }}
                                        to="/projects/$projectId/settings"
                                    />
                                }
                                size="xs"
                                variant="outline"
                            >
                                <Settings data-icon="inline-start" />
                                {t("settings.link")}
                            </Button>
                            <Button
                                nativeButton={false}
                                render={
                                    <a
                                        href={project.github_html_url}
                                        rel="noreferrer"
                                        target="_blank"
                                    />
                                }
                                size="xs"
                                variant="outline"
                            >
                                GitHub
                                <ExternalLink data-icon="inline-end" />
                            </Button>
                        </div>
                    </div>
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
