import { FolderGit2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { signInWithGitHub, useAuth } from "@/features/auth";
import {
    useDeleteProject,
    useProjects,
} from "@/features/projects/model/use-projects";
import { AddProjectDialog } from "@/features/projects/ui/add-project-dialog";
import { ProjectCard } from "@/features/projects/ui/project-card";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export function ProjectsPage() {
    const { t } = useTranslation("home");
    const { githubAccessToken, user } = useAuth();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const { data: projects = [], error, isLoading } = useProjects();
    const deleteProject = useDeleteProject();

    const canAddFromGitHub = Boolean(githubAccessToken && user);

    const handleRemove = async (projectId: string) => {
        await deleteProject.mutateAsync(projectId);
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-3xl font-bold tracking-tight">
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>

                {canAddFromGitHub ? (
                    <Button onClick={() => setIsAddOpen(true)} type="button">
                        <Plus data-icon="inline-start" />
                        {t("addProject")}
                    </Button>
                ) : (
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <Alert className="max-w-md">
                            <FolderGit2 />
                            <AlertDescription>
                                {t("githubRequired")}
                            </AlertDescription>
                        </Alert>
                        <Button
                            onClick={() => signInWithGitHub()}
                            type="button"
                            variant="outline"
                        >
                            {t("reconnectGitHub")}
                        </Button>
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="flex justify-center py-16">
                    <Spinner className="size-8 text-primary" />
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{t("projectsError")}</AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && projects.length === 0 && (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FolderGit2 />
                        </EmptyMedia>
                        <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                        <EmptyDescription>
                            {t("emptyDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                    {canAddFromGitHub && (
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
                    )}
                </Empty>
            )}

            {projects.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {projects.map((project) => (
                        <ProjectCard
                            isRemoving={deleteProject.isPending}
                            key={project.id}
                            onRemove={handleRemove}
                            project={project}
                        />
                    ))}
                </div>
            )}

            {user && githubAccessToken && (
                <AddProjectDialog
                    accessToken={githubAccessToken}
                    connectedProjects={projects}
                    onOpenChange={setIsAddOpen}
                    open={isAddOpen}
                    userId={user.id}
                />
            )}
        </div>
    );
}
