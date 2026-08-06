import { useNavigate } from "@tanstack/react-router";
import { FolderGit2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

import { useProjects } from "@/features/projects/model/use-projects";
import { ProjectCard } from "@/features/projects/ui/project-card";
import { buildHomeAllProjects } from "@/features/teams/model/build-home-all-projects";
import { useTeams } from "@/features/teams/model/use-teams";
import { CreateTeamDialog } from "@/features/teams/ui/create-team-dialog";
import { TeamCard } from "@/features/teams/ui/team-card";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";

const SKELETON_COUNT = 4;

type HomeView = "all-projects" | "teams";

export function TeamsPage() {
    const { t } = useTranslation("home");
    const navigate = useNavigate();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [view, setView] = useState<HomeView>("teams");
    const {
        data: teams = [],
        error: teamsError,
        isLoading: teamsLoading,
    } = useTeams();
    const {
        data: projects = [],
        error: projectsError,
        isLoading: projectsLoading,
    } = useProjects();

    const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
    const allProjectRows = buildHomeAllProjects(projects, teamNameById);

    const isTeamsView = view === "teams";
    const isLoading = isTeamsView
        ? teamsLoading
        : projectsLoading || teamsLoading;
    const error = isTeamsView ? teamsError : projectsError;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1>{t("title")}</h1>
                    <p className="text-body text-muted-foreground">
                        {isTeamsView ? t("subtitle") : t("allProjectsSubtitle")}
                    </p>
                </div>
                {isTeamsView ? (
                    <Button onClick={() => setIsCreateOpen(true)} type="button">
                        <Plus data-icon="inline-start" />
                        {t("createTeam")}
                    </Button>
                ) : undefined}
            </div>

            <div
                aria-label={t("homeViewLabel")}
                className="flex min-w-0 flex-wrap gap-2"
                role="group"
            >
                {(
                    [
                        ["teams", t("viewTeams")],
                        ["all-projects", t("viewAllProjects")],
                    ] as const
                ).map(([value, label]) => (
                    <Button
                        aria-pressed={view === value}
                        key={value}
                        onClick={() => {
                            setView(value);
                        }}
                        size="sm"
                        type="button"
                        variant={view === value ? "default" : "outline"}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            {isLoading && (
                <div
                    aria-busy="true"
                    aria-live="polite"
                    className="grid gap-4 sm:grid-cols-2"
                    role="status"
                >
                    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                        <Card aria-hidden key={index}>
                            <CardHeader>
                                <CardTitle>
                                    <Skeleton />
                                </CardTitle>
                                <CardDescription>
                                    <Skeleton />
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>
                        {isTeamsView ? t("teamsError") : t("projectsError")}
                    </AlertDescription>
                </Alert>
            )}

            {isTeamsView && !isLoading && !error && teams.length === 0 && (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Users />
                        </EmptyMedia>
                        <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                        <EmptyDescription>
                            {t("emptyDescription")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            type="button"
                            variant="outline"
                        >
                            <Plus data-icon="inline-start" />
                            {t("createTeam")}
                        </Button>
                    </EmptyContent>
                </Empty>
            )}

            {!isTeamsView &&
                !isLoading &&
                !error &&
                allProjectRows.length === 0 && (
                    <Empty className="border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FolderGit2 />
                            </EmptyMedia>
                            <EmptyTitle>
                                {t("allProjectsEmptyTitle")}
                            </EmptyTitle>
                            <EmptyDescription>
                                {t("allProjectsEmptyDescription")}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}

            {isTeamsView && !isLoading && teams.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {teams.map((team) => (
                        <TeamCard key={team.id} team={team} />
                    ))}
                </div>
            )}

            {!isTeamsView && !isLoading && allProjectRows.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    {allProjectRows.map(({ project, teamName }) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            teamName={teamName || undefined}
                        />
                    ))}
                </div>
            )}

            <CreateTeamDialog
                onCreated={(teamId) => {
                    void navigate({
                        params: { teamId },
                        to: "/teams/$teamId",
                    });
                }}
                onOpenChange={setIsCreateOpen}
                open={isCreateOpen}
            />
        </div>
    );
}
