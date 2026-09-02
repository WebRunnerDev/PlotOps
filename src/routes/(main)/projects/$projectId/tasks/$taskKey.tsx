import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { resolveProjectByReference } from "@/features/projects/lib/resolve-project-reference";
import { useProjects } from "@/features/projects/model/use-projects";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute(
    "/(main)/projects/$projectId/tasks/$taskKey"
)({
    component: TaskDeepLinkRoute,
});

function TaskDeepLinkRoute() {
    const { projectId: projectReference, taskKey } = Route.useParams();
    const navigate = useNavigate();
    const { t } = useTranslation("board");
    const { data: projects, isLoading: isProjectsLoading } = useProjects();
    const project = resolveProjectByReference(projects, projectReference);
    const {
        data: tasks,
        error: tasksError,
        isLoading: isTasksLoading,
    } = useProjectTasks(project?.id ?? "", Boolean(project));

    useEffect(() => {
        if (isProjectsLoading || isTasksLoading || !project || !tasks) {
            return;
        }

        const task = tasks.find(
            (entry) => entry.key.toUpperCase() === taskKey.trim().toUpperCase()
        );

        if (!task) {
            toast.error(t("fields.taskLinkNotFound"));
            void navigate({ replace: true, to: "/home" });
            return;
        }

        void navigate({
            params: {
                boardId: task.boardId,
                projectId: project.id,
            },
            replace: true,
            search: { task: task.key },
            to: "/projects/$projectId/boards/$boardId",
        });
    }, [
        isProjectsLoading,
        isTasksLoading,
        navigate,
        project,
        projectReference,
        t,
        taskKey,
        tasks,
        tasksError,
    ]);

    if (!isProjectsLoading && !project) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center px-4">
                <p className="text-ui text-muted-foreground">
                    {t("fields.taskLinkNotFound")}
                </p>
            </div>
        );
    }

    return (
        <div className="flex min-h-[40vh] items-center justify-center px-4">
            <Spinner className="size-8 text-primary" />
        </div>
    );
}
