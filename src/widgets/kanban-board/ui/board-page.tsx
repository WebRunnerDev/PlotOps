import { GitBranch, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import { BoardSwitcher, useProjectBoards } from "@/features/boards";
import { buildGithubTreeUrl } from "@/features/projects/model/github-project-links";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { BoardSprintControls } from "@/features/sprints";
import { BoardArchiveDialog } from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { resolveBoardNewTaskCtaVisible } from "@/widgets/kanban-board/model/resolve-board-new-task-cta-visible";
import { resolveBoardPagePresence } from "@/widgets/kanban-board/model/resolve-board-page-presence";

import { BoardLoading } from "./board-loading";
import { KanbanBoard } from "./kanban-board";

type BoardPageProperties = {
    boardId: string;
    projectId: string;
};

export function BoardPage({ boardId, projectId }: BoardPageProperties) {
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const {
        data: project,
        error,
        isLoading: projectLoading,
    } = useProject(projectId);
    const {
        data: boards = [],
        isError: boardsError,
        isPending: boardsLoading,
    } = useProjectBoards(projectId);
    const {
        canCreateTasks,
        canManageBoard,
        isError: accessError,
        isSettled,
    } = useProjectAccess(projectId);
    const [openCreateTaskRequestKey, setOpenCreateTaskRequestKey] = useState(0);
    const showNewTaskCta = resolveBoardNewTaskCtaVisible({
        canCreateTasks,
        isSettled,
    });

    const presence = resolveBoardPagePresence({
        boardId,
        boards: boards.map((board) => ({
            baseBranch: board.baseBranch,
            id: board.id,
        })),
        boardsError,
        boardsLoading,
        project,
        projectError: Boolean(error) && !project,
        projectLoading,
    });

    if (
        presence.kind === "project-loading" ||
        presence.kind === "boards-loading"
    ) {
        return <BoardLoading />;
    }

    if (presence.kind === "project-error") {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (presence.kind === "boards-error") {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("boardsLoadFailed")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (presence.kind === "board-not-found") {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("boardNotFound")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const { currentBoard } = presence;
    const baseBranch =
        currentBoard.baseBranch || project.github_default_branch || "main";
    const branchUrl = buildGithubTreeUrl(project.github_html_url, baseBranch);

    const branchLabel = (
        <>
            <GitBranch aria-hidden className="size-3.5" />
            {baseBranch}
        </>
    );

    return (
        <div className="@container/board scrollbar-board h-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full flex-col gap-3 pt-2">
                <header className="sticky left-0 z-10 w-[100cqw] shrink-0 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-sm sm:px-12">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <BoardSwitcher
                            boardId={boardId}
                            canManage={isSettled && canManageBoard}
                            defaultBaseBranch={
                                project.github_default_branch ?? "main"
                            }
                            projectId={projectId}
                        />
                        {branchUrl ? (
                            <a
                                className="inline-flex h-8 min-w-0 items-center gap-1.5 text-code text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2"
                                href={branchUrl}
                                rel="noreferrer noopener"
                                target="_blank"
                            >
                                {branchLabel}
                            </a>
                        ) : (
                            <span className="inline-flex h-8 min-w-0 items-center gap-1.5 text-code text-muted-foreground">
                                {branchLabel}
                            </span>
                        )}
                        <div className="flex min-w-0 flex-wrap items-stretch gap-2">
                            <BoardSprintControls
                                boardId={boardId}
                                projectId={projectId}
                            />
                            <BoardArchiveDialog
                                boardId={boardId}
                                projectId={projectId}
                            />
                        </div>
                        {showNewTaskCta ? (
                            <Button
                                className="ml-auto min-w-0 shrink focus-visible:ring-2"
                                onClick={() =>
                                    setOpenCreateTaskRequestKey(
                                        (key) => key + 1
                                    )
                                }
                                size="xs"
                                type="button"
                            >
                                <Plus aria-hidden data-icon="inline-start" />
                                <span className="truncate">
                                    {t("tasks.newTask")}
                                </span>
                            </Button>
                        ) : undefined}
                    </div>
                    {accessError ? (
                        <Alert className="mt-2" variant="destructive">
                            <AlertDescription>
                                {t("accessLoadFailed")}
                            </AlertDescription>
                        </Alert>
                    ) : undefined}
                </header>

                <div className="min-h-0 min-w-0 flex-1 px-3 sm:px-12">
                    <KanbanBoard
                        boardId={currentBoard.id}
                        githubToken={githubAccessToken}
                        openCreateTaskRequestKey={openCreateTaskRequestKey}
                        projectId={projectId}
                        repoFullName={project.github_full_name ?? undefined}
                    />
                </div>
            </div>
        </div>
    );
}
