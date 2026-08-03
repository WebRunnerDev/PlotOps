import { Link } from "@tanstack/react-router";
import { FolderGit2, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

import type { Project } from "@/features/projects/model/types";

import { signInWithGitHub, useAuth } from "@/features/auth";
import {
    useDeleteProject,
    useProjectsByTeam,
} from "@/features/projects/model/use-projects";
import { AddProjectDialog } from "@/features/projects/ui/add-project-dialog";
import { ProjectCard } from "@/features/projects/ui/project-card";
import { useTeamAccess } from "@/features/teams/model/use-team-access";
import { useTeam } from "@/features/teams/model/use-team-members";
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
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const PROJECT_SKELETON_COUNT = 4;

type TeamProjectsPageProperties = {
    teamId: string;
};

export function TeamProjectsPage({ teamId }: TeamProjectsPageProperties) {
    const { t } = useTranslation("home");
    const { githubAccessToken, user } = useAuth();
    const {
        data: team,
        error: teamError,
        isLoading: teamLoading,
    } = useTeam(teamId);
    const {
        canCreateProject,
        canView,
        isError: accessError,
        isLoading: accessLoading,
    } = useTeamAccess(teamId);
    const {
        data: projects = [],
        error: projectsError,
        isLoading: projectsLoading,
    } = useProjectsByTeam(teamId);
    const deleteProject = useDeleteProject();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [projectToRemove, setProjectToRemove] = useState<null | Project>(
        null
    );

    const isLoading = teamLoading || accessLoading || projectsLoading;
    const canAddFromGitHub = Boolean(
        canCreateProject && githubAccessToken && user
    );
    const showGitHubReconnect = canCreateProject && !canAddFromGitHub;

    const handleConfirmRemove = async () => {
        if (!projectToRemove) return;
        try {
            await deleteProject.mutateAsync(projectToRemove.id);
            setProjectToRemove(null);
        } catch {
            toast.error(t("removeProjectFailed"));
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-1">
                    <Skeleton width={220} />
                    <Skeleton width={160} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from(
                        { length: PROJECT_SKELETON_COUNT },
                        (_, index) => (
                            <Card aria-hidden key={index}>
                                <CardHeader>
                                    <CardTitle>
                                        <Skeleton />
                                    </CardTitle>
                                    <CardDescription>
                                        <Skeleton />
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Skeleton count={2} />
                                </CardContent>
                                <CardFooter>
                                    <Skeleton />
                                </CardFooter>
                            </Card>
                        )
                    )}
                </div>
            </div>
        );
    }

    if (accessError || teamError || !team || !canView) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{t("teamLoadFailed")}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="truncate">{team.name}</h1>
                    <p className="text-body text-muted-foreground">
                        {t("teamProjectsSubtitle")}
                    </p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    {showGitHubReconnect ? (
                        <Alert className="max-w-md">
                            <FolderGit2 />
                            <AlertDescription>
                                {t("githubRequired")}
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {canAddFromGitHub ? (
                            <Button
                                onClick={() => setIsAddOpen(true)}
                                type="button"
                            >
                                <Plus data-icon="inline-start" />
                                {t("addProject")}
                            </Button>
                        ) : null}
                        {showGitHubReconnect ? (
                            <Button
                                onClick={() => signInWithGitHub()}
                                type="button"
                                variant="outline"
                            >
                                {t("reconnectGitHub")}
                            </Button>
                        ) : null}
                        <Button
                            nativeButton={false}
                            render={
                                <Link
                                    params={{ teamId }}
                                    to="/teams/$teamId/settings"
                                />
                            }
                            variant="outline"
                        >
                            <Settings data-icon="inline-start" />
                            {t("openTeamSettings")}
                        </Button>
                    </div>
                </div>
            </div>

            {projectsError && (
                <Alert variant="destructive">
                    <AlertDescription>{t("projectsError")}</AlertDescription>
                </Alert>
            )}

            {!projectsError && projects.length === 0 && (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FolderGit2 />
                        </EmptyMedia>
                        <EmptyTitle>{t("teamEmptyProjectsTitle")}</EmptyTitle>
                        <EmptyDescription>
                            {t("teamEmptyProjectsDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                    {canAddFromGitHub ? (
                        <EmptyContent>
                            <Button
                                onClick={() => setIsAddOpen(true)}
                                type="button"
                                variant="outline"
                            >
                                <Plus data-icon="inline-start" />
                                {t("addProject")}
                            </Button>
                        </EmptyContent>
                    ) : null}
                </Empty>
            )}

            {projects.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {projects.map((project) => (
                        <ProjectCard
                            isRemoving={
                                deleteProject.isPending &&
                                projectToRemove?.id === project.id
                            }
                            key={project.id}
                            onRemove={setProjectToRemove}
                            project={project}
                        />
                    ))}
                </div>
            )}

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !deleteProject.isPending) {
                        setProjectToRemove(null);
                    }
                }}
                open={projectToRemove !== null}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("removeProjectTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("removeProjectDescription", {
                                name: projectToRemove?.name ?? "",
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteProject.isPending}>
                            {t("removeProjectCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleteProject.isPending}
                            onClick={() => {
                                void handleConfirmRemove();
                            }}
                            variant="destructive"
                        >
                            {deleteProject.isPending ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t("removeProjectConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {user && githubAccessToken && canCreateProject ? (
                <AddProjectDialog
                    accessToken={githubAccessToken}
                    connectedProjects={projects}
                    onOpenChange={setIsAddOpen}
                    open={isAddOpen}
                    teamId={teamId}
                    userId={user.id}
                />
            ) : null}
        </div>
    );
}
