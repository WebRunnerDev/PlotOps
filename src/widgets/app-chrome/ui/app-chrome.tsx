import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CommandPaletteTrigger } from "@/features/command-palette";
import { NotificationDrawer } from "@/features/notifications/ui/notification-drawer";
import { useProject } from "@/features/projects/model/use-projects";
import { cn } from "@/shared/lib/utils";

import { ProjectSectionNav } from "./project-section-nav";
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
                "sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 backdrop-blur-sm",
                "relative flex flex-col gap-1 py-1 sm:block sm:h-12 sm:py-0",
                "[view-transition-name:app-chrome]"
            )}
        >
            <div className="flex min-h-10 items-center gap-2 sm:h-12 sm:min-h-0">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Link
                        className="shrink-0 font-mono text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 focus-visible:ring-2"
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
                                className="size-3.5 shrink-0 opacity-50 max-sm:hidden"
                            />
                            <Link
                                className="hidden shrink-0 hover:text-foreground focus-visible:ring-2 sm:inline"
                                to="/home"
                            >
                                {t("nav.projects")}
                            </Link>
                            {project?.name ? (
                                <>
                                    <ChevronRight
                                        aria-hidden
                                        className="hidden size-3.5 shrink-0 opacity-50 sm:block"
                                    />
                                    {boardId ? (
                                        <Link
                                            className="truncate text-foreground hover:text-foreground/80 focus-visible:ring-2"
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

                <div className="flex shrink-0 items-center gap-2">
                    <CommandPaletteTrigger />
                    <NotificationDrawer />
                    <UserMenu />
                </div>
            </div>

            {projectId ? (
                <div className="min-w-0 overflow-x-auto sm:absolute sm:inset-y-0 sm:left-1/2 sm:flex sm:max-w-[min(100%,28rem)] sm:-translate-x-1/2 sm:items-center sm:overflow-x-auto">
                    <ProjectSectionNav
                        boardId={boardId}
                        projectId={projectId}
                    />
                </div>
            ) : null}
        </header>
    );
}
