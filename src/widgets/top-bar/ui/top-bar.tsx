import { Link, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CommandPaletteTrigger } from "@/features/command-palette";
import { NotificationDrawer } from "@/features/notifications/ui/notification-drawer";
import { useProject } from "@/features/projects/model/use-projects";
import { useTeam } from "@/features/teams/model/use-team-members";
import { cn } from "@/shared/lib/utils";

import { ProjectSectionNav } from "./project-section-nav";
import { UserMenu } from "./user-menu";

export function TopBar() {
    const { t } = useTranslation("common");
    const parameters = useParams({ strict: false });
    const projectId =
        typeof parameters.projectId === "string"
            ? parameters.projectId
            : undefined;
    const boardId =
        typeof parameters.boardId === "string" ? parameters.boardId : undefined;
    const teamIdFromRoute =
        typeof parameters.teamId === "string" ? parameters.teamId : undefined;

    const { data: project } = useProject(projectId ?? "");
    const teamId = teamIdFromRoute ?? project?.team_id;
    const { data: team } = useTeam(teamId ?? "");

    const showBreadcrumb = Boolean(teamId || projectId);

    return (
        <header
            className={cn(
                "sticky top-0 z-40 shrink-0 border-b border-border bg-background/95 px-4 backdrop-blur-sm",
                // Mobile: brand | actions, nav on second row.
                // sm+: three equal columns — center scrolls instead of overlapping sides.
                "grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1 py-1",
                "sm:h-12 sm:grid-cols-3 sm:grid-rows-1 sm:gap-3 sm:py-0",
                "[view-transition-name:top-bar]"
            )}
        >
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
                <Link
                    className="shrink-0 font-mono text-sm font-semibold tracking-tight text-foreground hover:text-foreground/80 focus-visible:ring-2"
                    to="/home"
                >
                    PlotOps
                </Link>

                {showBreadcrumb ? (
                    <nav
                        aria-label={t("nav.breadcrumb")}
                        className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground"
                    >
                        <ChevronRight
                            aria-hidden
                            className="size-3.5 shrink-0 opacity-50 max-sm:hidden"
                        />
                        {teamId && team?.name ? (
                            <Link
                                className={cn(
                                    "hidden min-w-0 truncate hover:text-foreground focus-visible:ring-2 sm:inline",
                                    !projectId && "text-foreground"
                                )}
                                params={{ teamId }}
                                to="/teams/$teamId"
                            >
                                {team.name}
                            </Link>
                        ) : null}
                        {projectId && project?.name ? (
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

            {projectId ? (
                <div className="col-span-2 row-start-2 min-w-0 overflow-x-auto overflow-y-hidden sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-stretch">
                    <div className="flex min-w-0 justify-center">
                        <ProjectSectionNav
                            boardId={boardId}
                            projectId={projectId}
                        />
                    </div>
                </div>
            ) : null}

            <div className="col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 sm:col-start-3">
                <CommandPaletteTrigger />
                <NotificationDrawer />
                <UserMenu />
            </div>
        </header>
    );
}
