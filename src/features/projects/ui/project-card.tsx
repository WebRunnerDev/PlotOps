import { useNavigate } from "@tanstack/react-router";
import {
    ArrowUpRight,
    ExternalLink,
    GitBranch,
    Lock,
    Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Project } from "@/features/projects/model/types";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { Button } from "@/shared/shadcn/ui/button";
import { Card } from "@/shared/shadcn/ui/card";

type ProjectCardProperties = {
    index?: number;
    isRemoving?: boolean;
    /** When omitted, the card is navigate-only (no delete control). */
    onRemove?: (project: Project) => void;
    project: Project;
    /** Optional Team label for cross-Team lists (e.g. Home All projects). */
    teamName?: string;
};

export function ProjectCard({
    index,
    isRemoving = false,
    onRemove,
    project,
    teamName,
}: ProjectCardProperties) {
    const { t } = useTranslation("home");
    const navigate = useNavigate();
    const { canDeleteProject, isSettled } = useProjectAccess(project.id);
    const canDelete = Boolean(onRemove) && isSettled && canDeleteProject;
    const defaultBranch = project.github_default_branch ?? "main";

    const openProject = () => {
        void navigate({
            params: { projectId: project.id },
            to: "/projects/$projectId",
        });
    };

    return (
        <Card
            className="group relative cursor-pointer overflow-hidden rounded-none py-4 ring-border/60 transition-[transform,box-shadow,ring-color] duration-300 ease-(--ease-out-expo) hover:-translate-y-0.5 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={openProject}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProject();
                }
            }}
            role="link"
            tabIndex={0}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-primary transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100 group-focus-visible:scale-y-100"
            />

            <div className="flex min-w-0 flex-col gap-3 px-4">
                <div className="flex min-w-0 items-start gap-3">
                    {index == undefined ? undefined : (
                        <span className="font-heading pt-0.5 text-[clamp(1.5rem,0.9rem+1.5vw,2rem)] font-bold leading-none tracking-[-0.04em] text-primary/35 tabular-nums transition-colors duration-300 ease-(--ease-out-expo) group-hover:text-primary/60">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                            <h3 className="min-w-0 truncate text-h3">
                                {project.name}
                            </h3>
                            {project.is_private ? (
                                <Lock
                                    aria-hidden
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                />
                            ) : undefined}
                        </div>
                        {teamName ? (
                            <p className="min-w-0 truncate text-meta text-muted-foreground">
                                {teamName}
                            </p>
                        ) : undefined}
                        {project.github_full_name ? (
                            <p className="min-w-0 truncate text-code text-muted-foreground">
                                {project.github_full_name}
                            </p>
                        ) : undefined}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                        {canDelete && onRemove ? (
                            <Button
                                aria-label={t("removeProject")}
                                className="opacity-0 transition-opacity duration-300 ease-(--ease-out-expo) group-hover:opacity-100 focus-visible:opacity-100"
                                disabled={isRemoving}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemove(project);
                                }}
                                size="icon-sm"
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 />
                            </Button>
                        ) : undefined}
                        <ArrowUpRight
                            aria-hidden
                            className="size-4 text-muted-foreground opacity-40 transition-[opacity,transform,color] duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                    </div>
                </div>

                {project.description ? (
                    <p className="line-clamp-2 text-ui text-muted-foreground">
                        {project.description}
                    </p>
                ) : undefined}

                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/60 pt-3">
                    {project.github_repo_id == undefined ? (
                        <span className="text-meta text-muted-foreground">
                            {t("projectNoGitHub")}
                        </span>
                    ) : (
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-code text-muted-foreground">
                            <GitBranch
                                aria-hidden
                                className="size-3.5 shrink-0 text-primary/70 transition-colors duration-300 ease-(--ease-out-expo) group-hover:text-primary"
                            />
                            <span className="truncate">{defaultBranch}</span>
                        </span>
                    )}

                    {project.github_html_url ? (
                        <Button
                            className="shrink-0"
                            nativeButton={false}
                            onClick={(event) => {
                                event.stopPropagation();
                            }}
                            render={
                                <a
                                    href={project.github_html_url}
                                    rel="noreferrer"
                                    target="_blank"
                                />
                            }
                            size="xs"
                            variant="link"
                        >
                            GitHub
                            <ExternalLink data-icon="inline-end" />
                        </Button>
                    ) : undefined}
                </div>
            </div>
        </Card>
    );
}
