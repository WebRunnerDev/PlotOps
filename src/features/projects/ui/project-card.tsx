import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, GitBranch, Lock, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Project } from "@/features/projects/model/types";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";

type ProjectCardProperties = {
    isRemoving?: boolean;
    /** When omitted, the card is navigate-only (no delete control). */
    onRemove?: (project: Project) => void;
    project: Project;
    /** Optional Team label for cross-Team lists (e.g. Home All projects). */
    teamName?: string;
};

export function ProjectCard({
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

    return (
        <Card
            className="group cursor-pointer transition-colors hover:ring-primary/40"
            onClick={() =>
                void navigate({
                    params: { projectId: project.id },
                    to: "/projects/$projectId",
                })
            }
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void navigate({
                        params: { projectId: project.id },
                        to: "/projects/$projectId",
                    });
                }
            }}
            role="link"
            tabIndex={0}
        >
            <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.is_private && (
                        <Lock
                            aria-hidden
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                    )}
                </CardTitle>
                {teamName ? (
                    <CardDescription className="min-w-0 truncate text-meta">
                        {teamName}
                    </CardDescription>
                ) : undefined}
                {project.github_full_name ? (
                    <CardDescription className="truncate text-code">
                        {project.github_full_name}
                    </CardDescription>
                ) : undefined}
                {canDelete && onRemove ? (
                    <CardAction>
                        <Button
                            aria-label={t("removeProject")}
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
                    </CardAction>
                ) : undefined}
            </CardHeader>

            {project.description && (
                <CardContent className="-mt-2">
                    <p className="line-clamp-2 text-ui text-muted-foreground">
                        {project.description}
                    </p>
                </CardContent>
            )}

            <CardFooter className="justify-between border-0 bg-transparent">
                <span className="inline-flex items-center gap-1.5 text-code text-muted-foreground">
                    <GitBranch />
                    {defaultBranch}
                </span>

                {project.github_html_url ? (
                    <Button
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
            </CardFooter>
        </Card>
    );
}
