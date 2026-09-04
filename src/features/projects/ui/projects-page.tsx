import { FolderGit2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

import type { Project } from "@/features/projects/model/types";

import {
    useDeleteProject,
    useProjects,
} from "@/features/projects/model/use-projects";
import { ProjectCard } from "@/features/projects/ui/project-card";
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
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const PROJECT_SKELETON_COUNT = 4;

/** @deprecated Prefer Team projects list (`TeamProjectsPage`); create under a Team. */
export function ProjectsPage() {
    const { t } = useTranslation("home");
    const [projectToRemove, setProjectToRemove] = useState<null | Project>(
        null
    );
    const { data: projects = [], isError, isLoading } = useProjects();
    const deleteProject = useDeleteProject();

    const handleConfirmRemove = async () => {
        if (!projectToRemove) return;

        try {
            await deleteProject.mutateAsync(projectToRemove.id);
            setProjectToRemove(null);
        } catch {
            toast.error(t("removeProjectFailed"));
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
                <h1>{t("title")}</h1>
                <p className="text-body text-muted-foreground">
                    {t("subtitle")}
                </p>
            </div>

            {isLoading && (
                <div
                    aria-busy="true"
                    aria-live="polite"
                    className="grid gap-4 sm:grid-cols-2"
                    role="status"
                >
                    {Array.from(
                        { length: PROJECT_SKELETON_COUNT },
                        (_, index) => (
                            <Card aria-hidden key={index}>
                                <CardHeader>
                                    <CardTitle>
                                        <Skeleton />
                                    </CardTitle>
                                    <CardDescription className="text-code">
                                        <Skeleton />
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="-mt-2">
                                    <p className="line-clamp-2 text-ui text-muted-foreground">
                                        <Skeleton count={2} />
                                    </p>
                                </CardContent>
                                <CardFooter className="justify-between border-0 bg-transparent">
                                    <span className="text-code text-muted-foreground">
                                        <Skeleton />
                                    </span>
                                    <Skeleton />
                                </CardFooter>
                            </Card>
                        )
                    )}
                </div>
            )}

            {isError && !isLoading && (
                <Alert variant="destructive">
                    <AlertDescription>{t("projectsError")}</AlertDescription>
                </Alert>
            )}

            {!isLoading && !isError && projects.length === 0 && (
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
                </Empty>
            )}

            {projects.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {projects.map((project, index) => (
                        <ProjectCard
                            index={index}
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
        </div>
    );
}
