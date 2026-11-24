import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/model/use-auth";
import { useBoardColumns } from "@/features/boards";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { todayIsoDate } from "@/features/sprints/api/sprints-api";
import { formatSprintDateRange } from "@/features/sprints/model/format-sprint-dates";
import {
    useBoardSprints,
    useSprintMutations,
} from "@/features/sprints/model/use-sprints";
import { CloseSprintDialog } from "@/features/sprints/ui/sprint-lifecycle-dialogs";
import { SprintReportPanel } from "@/features/sprints/ui/sprint-report-panel";
import { SprintStateBadge } from "@/features/sprints/ui/sprint-state-badge";
import {
    SprintsPageFrame,
    SprintsPageHeader,
} from "@/features/sprints/ui/sprints-page";
import {
    TaskDrawer,
    useBoardTasks,
    useTasksUiStore,
    withoutEpics,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button, buttonVariants } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type SprintReportPageProperties = {
    boardId: string;
    projectId: string;
    sprintId: string;
};

/** One Sprint's report at its own URL (linkable from chat, PRs, notes). */
export function SprintReportPage({
    boardId,
    projectId,
    sprintId,
}: SprintReportPageProperties) {
    const { i18n, t } = useTranslation("board");
    const navigate = useNavigate();
    const { githubAccessToken } = useAuth();
    const { canManageBoard, isSettled } = useProjectAccess(projectId);
    const canManage = isSettled && canManageBoard;
    const { data: project } = useProject(projectId);
    const columnsApi = useBoardColumns(projectId, boardId);
    const tasksApi = useBoardTasks(projectId, boardId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const { data: sprintsData, isLoading: sprintsLoading } =
        useBoardSprints(boardId);
    const { removePast } = useSprintMutations(projectId, boardId);
    const [closeOpen, setCloseOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const sprints = useMemo(() => sprintsData ?? [], [sprintsData]);
    const tasks = useMemo(() => withoutEpics(tasksApi.tasks), [tasksApi.tasks]);
    const sprint = sprints.find((item) => item.id === sprintId);
    const members = useMemo(
        () => tasks.filter((task) => task.sprintId === sprintId),
        [sprintId, tasks]
    );

    const backLink = (
        <Link
            className={cn(
                buttonVariants({ size: "sm", variant: "ghost" }),
                "-ml-2 self-start rounded-none text-muted-foreground"
            )}
            params={{ boardId, projectId }}
            to="/projects/$projectId/boards/$boardId/sprints"
        >
            <ArrowLeft data-icon="inline-start" />
            {t("sprintsPage.backToSprints")}
        </Link>
    );

    if (sprintsLoading || columnsApi.isLoading || tasksApi.isLoading) {
        return (
            <SprintsPageFrame>
                {backLink}
                <div className="flex h-48 items-center justify-center">
                    <Spinner className="size-8 text-primary" />
                </div>
            </SprintsPageFrame>
        );
    }

    if (!sprint) {
        return (
            <SprintsPageFrame>
                {backLink}
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("sprintsPage.sprintNotFound")}
                    </AlertDescription>
                </Alert>
            </SprintsPageFrame>
        );
    }

    const isPast = sprint.state === "closed" || sprint.state === "canceled";
    const dateRange = formatSprintDateRange({
        endsOn: sprint.endsOn,
        locale: i18n.resolvedLanguage,
        startsOn: sprint.startsOn,
        today: todayIsoDate(),
    });

    const handleDelete = async () => {
        try {
            await removePast.mutateAsync(sprint.id);
            toast.success(t("sprints.pastDeleted", { name: sprint.name }));
            setDeleteOpen(false);
            void navigate({
                params: { boardId, projectId },
                to: "/projects/$projectId/boards/$boardId/sprints",
            });
        } catch {
            toast.error(t("sprints.pastDeleteFailed"));
        }
    };

    return (
        <SprintsPageFrame>
            {backLink}
            <SprintsPageHeader
                boardId={boardId}
                canManage={canManage}
                project={project}
                projectId={projectId}
                title={sprint.name}
            >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <SprintStateBadge state={sprint.state} />
                            {dateRange ? <span>{dateRange}</span> : null}
                        </div>
                        {sprint.goal ? (
                            <p className="max-w-2xl text-ui text-muted-foreground text-pretty">
                                {sprint.goal}
                            </p>
                        ) : null}
                    </div>
                    {canManage ? (
                        <div className="flex shrink-0 gap-2">
                            {sprint.state === "active" ? (
                                <Button
                                    className="rounded-none"
                                    onClick={() => setCloseOpen(true)}
                                    size="sm"
                                    type="button"
                                >
                                    {t("sprints.close")}
                                </Button>
                            ) : null}
                            {isPast ? (
                                <Button
                                    className="rounded-none"
                                    onClick={() => setDeleteOpen(true)}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t("sprints.deletePast")}
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </SprintsPageHeader>

            {sprint.state === "draft" ? (
                <p className="text-ui text-muted-foreground">
                    {t("sprintsPage.draftNoReport")}
                </p>
            ) : (
                <section className="min-w-0 border border-border bg-card/50">
                    <SprintReportPanel
                        boardId={boardId}
                        canManage={canManage}
                        columns={columnsApi.columns}
                        onOpenTask={selectTask}
                        projectId={projectId}
                        sprint={sprint}
                        tasks={tasks}
                    />
                </section>
            )}

            {sprint.state === "active" ? (
                <CloseSprintDialog
                    activeSprints={sprints.filter(
                        (item) => item.state === "active"
                    )}
                    boardId={boardId}
                    columns={columnsApi.columns}
                    draftSprints={sprints.filter(
                        (item) => item.state === "draft"
                    )}
                    onOpenChange={setCloseOpen}
                    open={closeOpen}
                    projectId={projectId}
                    sprint={sprint}
                    tasks={members}
                />
            ) : null}

            <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("sprints.deletePastTitle", {
                                name: sprint.name,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("sprints.deletePastDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removePast.isPending}>
                            {t("sprints.deletePastKeep")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={removePast.isPending}
                            onClick={() => {
                                void handleDelete();
                            }}
                            variant="destructive"
                        >
                            {t("sprints.deletePastConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <TaskDrawer
                boardId={boardId}
                githubToken={githubAccessToken}
                projectId={projectId}
                repositories={project?.repositories ?? []}
            />
        </SprintsPageFrame>
    );
}
