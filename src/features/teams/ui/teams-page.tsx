import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

import { useProjects } from "@/features/projects/model/use-projects";
import { ProjectCard } from "@/features/projects/ui/project-card";
import { buildHomeAllProjects } from "@/features/teams/model/build-home-all-projects";
import { useTeams } from "@/features/teams/model/use-teams";
import { CreateTeamDialog } from "@/features/teams/ui/create-team-dialog";
import { HomeEmptyPreview } from "@/features/teams/ui/home-empty-preview";
import { TeamCard } from "@/features/teams/ui/team-card";
import { cn } from "@/shared/lib/utils";
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
        isError: teamsError,
        isLoading: teamsLoading,
    } = useTeams();
    const {
        data: projects = [],
        isError: projectsError,
        isLoading: projectsLoading,
    } = useProjects();

    const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
    const allProjectRows = buildHomeAllProjects(projects, teamNameById);

    const isTeamsView = view === "teams";
    const isLoading = isTeamsView
        ? teamsLoading
        : projectsLoading || teamsLoading;
    const isError = isTeamsView ? teamsError : projectsError;
    const itemCount = isTeamsView ? teams.length : allProjectRows.length;

    return (
        <div className="relative flex min-w-0 flex-col gap-10 wrap-break-word sm:gap-12">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-4 h-64 bg-auth-atmosphere opacity-90 sm:-top-6 sm:h-80"
            />

            <header className="relative flex min-w-0 flex-col gap-6 sm:gap-8">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                    <div className="flex min-w-0 flex-col gap-3 motion-reveal sm:gap-4">
                        <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                            {t("eyebrow")}
                        </p>
                        <h1 className="max-w-[12ch] text-[clamp(2.25rem,1rem+4.5vw,3.75rem)] font-heading font-bold leading-[0.95] tracking-[-0.045em] text-foreground text-balance">
                            {isTeamsView ? t("title") : t("viewAllProjects")}
                        </h1>
                        <div aria-hidden className="h-px w-14 bg-primary/70" />
                        <p className="max-w-md text-body text-muted-foreground">
                            {isTeamsView
                                ? t("subtitle")
                                : t("allProjectsSubtitle")}
                        </p>
                    </div>

                    {isTeamsView ? (
                        <Button
                            className="motion-reveal shrink-0 self-start sm:self-end [animation-delay:120ms]"
                            onClick={() => setIsCreateOpen(true)}
                            type="button"
                        >
                            <Plus data-icon="inline-start" />
                            {t("createTeam")}
                        </Button>
                    ) : undefined}
                </div>

                <div className="flex min-w-0 flex-col gap-3 motion-reveal [animation-delay:160ms] sm:flex-row sm:items-center sm:justify-between">
                    <div
                        aria-label={t("homeViewLabel")}
                        className="inline-flex w-fit max-w-full min-w-0 rounded-none border border-border p-0.5"
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
                                className={cn(
                                    "min-w-0 flex-1 rounded-none px-3 sm:flex-none",
                                    view === value && "pointer-events-none"
                                )}
                                key={value}
                                onClick={() => {
                                    setView(value);
                                }}
                                size="sm"
                                type="button"
                                variant={view === value ? "secondary" : "ghost"}
                            >
                                <span className="truncate">{label}</span>
                            </Button>
                        ))}
                    </div>

                    {!isLoading && !isError ? (
                        <p className="font-mono text-meta text-muted-foreground tabular-nums">
                            {isTeamsView
                                ? t("countTeams", { count: itemCount })
                                : t("countProjects", { count: itemCount })}
                        </p>
                    ) : undefined}
                </div>
            </header>

            <div className="relative flex min-w-0 flex-col gap-4">
                {isLoading && (
                    <div
                        aria-busy="true"
                        aria-live="polite"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                        role="status"
                    >
                        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                            <Card
                                aria-hidden
                                className="motion-reveal rounded-none"
                                key={index}
                                style={{
                                    animationDelay: `${200 + index * 60}ms`,
                                }}
                            >
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

                {isError && !isLoading && (
                    <Alert
                        className="motion-reveal [animation-delay:200ms]"
                        variant="destructive"
                    >
                        <AlertDescription>
                            {isTeamsView ? t("teamsError") : t("projectsError")}
                        </AlertDescription>
                    </Alert>
                )}

                {isTeamsView &&
                    !isLoading &&
                    !isError &&
                    teams.length === 0 && (
                        <div className="motion-reveal flex flex-col items-center gap-8 border border-dashed border-border bg-card/30 px-4 py-10 [animation-delay:200ms] sm:gap-10 sm:px-8 sm:py-14">
                            <HomeEmptyPreview />
                            <Empty className="border-0 p-0">
                                <EmptyHeader>
                                    <EmptyTitle className="font-heading text-h3 tracking-tight">
                                        {t("emptyTitle")}
                                    </EmptyTitle>
                                    <EmptyDescription className="text-body">
                                        {t("emptyDescription")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button
                                        onClick={() => setIsCreateOpen(true)}
                                        type="button"
                                    >
                                        <Plus data-icon="inline-start" />
                                        {t("createTeam")}
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        </div>
                    )}

                {!isTeamsView &&
                    !isLoading &&
                    !isError &&
                    allProjectRows.length === 0 && (
                        <div className="motion-reveal flex flex-col items-center gap-8 border border-dashed border-border bg-card/30 px-4 py-10 [animation-delay:200ms] sm:gap-10 sm:px-8 sm:py-14">
                            <HomeEmptyPreview />
                            <Empty className="border-0 p-0">
                                <EmptyHeader>
                                    <EmptyTitle className="font-heading text-h3 tracking-tight">
                                        {t("allProjectsEmptyTitle")}
                                    </EmptyTitle>
                                    <EmptyDescription className="text-body">
                                        {t("allProjectsEmptyDescription")}
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        </div>
                    )}

                {isTeamsView && !isLoading && teams.length > 0 && (
                    <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4">
                        {teams.map((team, index) => (
                            <li
                                className="motion-reveal min-w-0"
                                key={team.id}
                                style={{
                                    animationDelay: `${220 + index * 70}ms`,
                                }}
                            >
                                <TeamCard index={index} team={team} />
                            </li>
                        ))}
                    </ul>
                )}

                {!isTeamsView && !isLoading && allProjectRows.length > 0 && (
                    <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4">
                        {allProjectRows.map(({ project, teamName }, index) => (
                            <li
                                className="motion-reveal min-w-0"
                                key={project.id}
                                style={{
                                    animationDelay: `${220 + index * 70}ms`,
                                }}
                            >
                                <ProjectCard
                                    index={index}
                                    project={project}
                                    teamName={teamName || undefined}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

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
