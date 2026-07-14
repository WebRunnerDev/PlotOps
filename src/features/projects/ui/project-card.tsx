import { ExternalLink, GitBranch, Lock, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Project } from "@/features/projects/model/types";

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

type ProjectCardProps = {
    isRemoving?: boolean;
    onRemove: (project: Project) => void;
    project: Project;
};

export function ProjectCard({
    isRemoving = false,
    onRemove,
    project,
}: ProjectCardProps) {
    const { t } = useTranslation("home");

    return (
        <Card className="group transition-colors hover:ring-primary/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="truncate">{project.name}</span>
                    {project.is_private && (
                        <Lock
                            aria-hidden
                            className="size-3.5 shrink-0 text-muted-foreground"
                        />
                    )}
                </CardTitle>
                <CardDescription className="text-code">
                    {project.github_full_name}
                </CardDescription>
                <CardAction>
                    <Button
                        aria-label={t("removeProject")}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        disabled={isRemoving}
                        onClick={() => onRemove(project)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <Trash2 />
                    </Button>
                </CardAction>
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
                    {project.github_default_branch}
                </span>

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
                    variant="link"
                >
                    GitHub
                    <ExternalLink data-icon="inline-end" />
                </Button>
            </CardFooter>
        </Card>
    );
}
