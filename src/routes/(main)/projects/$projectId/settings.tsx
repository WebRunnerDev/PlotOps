import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import { ProjectLabelsSettings } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { ProjectMembersSettings } from "@/features/projects/ui/project-members-settings";
import { BoardProvider } from "@/features/tasks/model/board-context";
import { useProjectBoards } from "@/features/tasks/model/use-project-boards";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { ProjectBoardsSettings } from "@/features/tasks/ui/project-boards-settings";
import { TaskDrawer } from "@/features/tasks/ui/task-drawer";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/(main)/projects/$projectId/settings")({
    component: ProjectSettingsRoute,
});

function ProjectSettingsRoute() {
    const { projectId } = Route.useParams();
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { data: project, error, isLoading } = useProject(projectId);
    const { canManageBoard } = useProjectAccess(projectId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const defaultBoardId = boards[0]?.id ?? "";
    const selectTask = useTasksUiStore((state) => state.selectTask);

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-24 md:p-8">
                <header className="flex flex-col gap-2">
                    <Button
                        className="w-fit"
                        nativeButton={false}
                        render={
                            <Link
                                params={{ projectId }}
                                to="/projects/$projectId"
                            />
                        }
                        size="sm"
                        variant="ghost"
                    >
                        <ArrowLeft data-icon="inline-start" />
                        {t("settings.backToBoard")}
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1>{t("settings.title")}</h1>
                        {project ? (
                            <p className="text-code text-muted-foreground">
                                {project.name}
                            </p>
                        ) : undefined}
                    </div>
                </header>

                {error || !project ? (
                    <Alert variant="destructive">
                        <AlertDescription>{t("projectError")}</AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <ProjectMembersSettings projectId={projectId} />
                        {canManageBoard ? (
                            <>
                                <ProjectBoardsSettings projectId={projectId} />
                                <ProjectLabelsSettings
                                    onOpenTask={selectTask}
                                    projectId={projectId}
                                />
                                {defaultBoardId ? (
                                    <BoardProvider
                                        boardId={defaultBoardId}
                                        projectId={projectId}
                                    >
                                        <TaskDrawer
                                            githubToken={githubAccessToken}
                                            projectId={projectId}
                                            repoFullName={
                                                project.github_full_name
                                            }
                                        />
                                    </BoardProvider>
                                ) : undefined}
                            </>
                        ) : undefined}
                    </>
                )}
            </div>
        </div>
    );
}
