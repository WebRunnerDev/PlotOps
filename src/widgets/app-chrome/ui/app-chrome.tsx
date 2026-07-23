import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useProject } from "@/features/projects/model/use-projects";
import { cn } from "@/shared/lib/utils";

import { UserMenu } from "./user-menu";

export function AppChrome() {
    const { t } = useTranslation("common");
    const parameters = useParams({ strict: false });
    const projectId =
        typeof parameters.projectId === "string"
            ? parameters.projectId
            : undefined;
    const boardId =
        typeof parameters.boardId === "string" ? parameters.boardId : undefined;
    const { data: project } = useProject(projectId ?? "");

    return (
        <header
            className={cn(
                "sticky top-0 z-40 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm",
                "[view-transition-name:app-chrome]"
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <Link
                    className="shrink-0 font-mono text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80"
                    to="/home"
                >
                    PlotOps
                </Link>

                {projectId ? (
                    <nav
                        aria-label={t("nav.breadcrumb")}
                        className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground"
                    >
                        <ChevronRight
                            aria-hidden
                            className="size-3.5 shrink-0 opacity-50"
                        />
                        <Link
                            className="shrink-0 hover:text-foreground"
                            to="/home"
                        >
                            {t("nav.projects")}
                        </Link>
                        {project?.name ? (
                            <>
                                <ChevronRight
                                    aria-hidden
                                    className="size-3.5 shrink-0 opacity-50"
                                />
                                {boardId ? (
                                    <Link
                                        className="truncate text-foreground hover:text-foreground/80"
                                        params={{ boardId, projectId }}
                                        to="/projects/$projectId/boards/$boardId"
                                    >
                                        {project.name}
                                    </Link>
                                ) : (
                                    <span className="truncate text-foreground">
                                        {project.name}
                                    </span>
                                )}
                            </>
                        ) : null}
                    </nav>
                ) : null}
            </div>

            <UserMenu />
        </header>
    );
}
