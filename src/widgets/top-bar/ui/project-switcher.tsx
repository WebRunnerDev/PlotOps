import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import { switchProjectIntent } from "@/features/command-palette";
import { useIsGuest } from "@/features/guest-mode";
import {
    canAddProjectToTeam,
    TEAM_PROJECTS_CAP,
    useProjects,
} from "@/features/projects";
import { AddProjectDialog } from "@/features/projects/ui/add-project-dialog";
import { useTeamAccess } from "@/features/teams";
import { cn } from "@/shared/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";

type ProjectSwitcherProperties = {
    projectId: string;
    teamId: string;
};

/** Chevron next to the Project crumb: switch between the Team's Projects. */
export function ProjectSwitcher({
    projectId,
    teamId,
}: ProjectSwitcherProperties) {
    const { t } = useTranslation(["common", "home"]);
    const navigate = useNavigate();
    const guest = useIsGuest();
    const { githubAccessToken, user } = useAuth();
    const { canCreateProject } = useTeamAccess(teamId);
    const { data: projects = [] } = useProjects();
    const [isAddOpen, setIsAddOpen] = useState(false);

    const teamProjects = projects.filter(
        (project) => project.team_id === teamId
    );
    const isProjectCapReached = !canAddProjectToTeam(teamProjects.length);
    const canAddProject = Boolean(!guest && canCreateProject && user);

    const goToProject = (nextProjectId: string) => {
        const intent = switchProjectIntent(nextProjectId);
        // `/projects/$projectId` redirects to the last remembered Board.
        void navigate({
            params: { projectId: intent.projectId },
            to: "/projects/$projectId",
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={t("projectSwitcher.label")}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent text-muted-foreground outline-none transition-colors duration-200 ease-[var(--ease-out-quart)] hover:bg-primary/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-popup-open:bg-primary/10 data-popup-open:text-foreground"
                >
                    <ChevronsUpDown aria-hidden className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                    {teamProjects.map((project) => (
                        <DropdownMenuItem
                            className="cursor-pointer"
                            key={project.id}
                            onClick={() => goToProject(project.id)}
                        >
                            <Check
                                className={cn(
                                    "size-3.5",
                                    project.id === projectId
                                        ? "opacity-100"
                                        : "opacity-0"
                                )}
                            />
                            <span className="truncate">{project.name}</span>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {canAddProject ? (
                        <>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={isProjectCapReached}
                                onClick={() => setIsAddOpen(true)}
                            >
                                <Plus className="size-3.5" />
                                {t("projectSwitcher.create")}
                            </DropdownMenuItem>
                            {isProjectCapReached ? (
                                <p className="px-1.5 pb-1 text-xs text-muted-foreground">
                                    {t("home:addProjectCapReached", {
                                        cap: TEAM_PROJECTS_CAP,
                                    })}
                                </p>
                            ) : null}
                        </>
                    ) : null}
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                            void navigate({
                                params: { teamId },
                                to: "/teams/$teamId",
                            })
                        }
                    >
                        <FolderKanban className="size-3.5" />
                        {t("projectSwitcher.allProjects")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Mounted only while open — the dialog loads GitHub repos on mount. */}
            {user && canAddProject && !isProjectCapReached && isAddOpen ? (
                <AddProjectDialog
                    accessToken={githubAccessToken}
                    connectedProjects={teamProjects}
                    onOpenChange={setIsAddOpen}
                    open={isAddOpen}
                    teamId={teamId}
                    userId={user.id}
                />
            ) : null}
        </>
    );
}
