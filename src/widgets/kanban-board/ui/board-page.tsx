import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, GitBranch, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useProject } from "@/features/projects/model/use-projects";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

import { KanbanBoard } from "./kanban-board";

type BoardPageProperties = {
    projectId: string;
};

export function BoardPage({ projectId }: BoardPageProperties) {
    const { t } = useTranslation("board");
    const { data: project, error, isLoading } = useProject(projectId);

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Button
                    nativeButton={false}
                    render={<Link to="/home" />}
                    size="sm"
                    variant="ghost"
                >
                    <ArrowLeft data-icon="inline-start" />
                    {t("backToProjects")}
                </Button>
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="@container/board scrollbar-board h-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full w-max min-w-full flex-col gap-6 pt-4 pb-24">
                <header className="sticky left-0 z-10 w-[100cqw] shrink-0 bg-background/95 px-12 backdrop-blur-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <Button
                                className="w-fit"
                                nativeButton={false}
                                render={<Link to="/home" />}
                                size="sm"
                                variant="ghost"
                            >
                                <ArrowLeft data-icon="inline-start" />
                                {t("backToProjects")}
                            </Button>
                            <div className="flex flex-col gap-1">
                                <h1>{project.name}</h1>
                                <p className="text-code text-muted-foreground">
                                    {project.github_full_name}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 text-code text-muted-foreground">
                                <GitBranch aria-hidden className="size-3.5" />
                                {project.github_default_branch}
                            </span>
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
                    <KanbanBoard projectId={projectId} />
                </div>
            </div>
        </div>
    );
}
