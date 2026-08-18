import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import {
    countTeamPeople,
    isSoloTeam,
    ProjectBoardsSettings,
    useProjectBoards,
} from "@/features/boards";
import { ProjectLabelsSettings, useProjectLabels } from "@/features/labels";
import {
    projectHasGithubRepo,
    resolveProjectConnectHash,
} from "@/features/projects/model/project-github-gate";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { ConnectProjectRepository } from "@/features/projects/ui/connect-project-repository";
import { TaskDrawer, useTasksUiStore } from "@/features/tasks";
import {
    useTeam,
    useTeamMembers,
} from "@/features/teams/model/use-team-members";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/(main)/projects/$projectId/settings")({
    component: ProjectSettingsRoute,
});

type SettingsSection = "boards" | "labels";

function ProjectSettingsRoute() {
    const { projectId } = Route.useParams();
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { data: project, error, isLoading } = useProject(projectId);
    const {
        canManageBoard,
        canManageMembers,
        canManageSettings,
        canView,
        isError: accessError,
        isLoading: accessLoading,
        isSettled,
    } = useProjectAccess(projectId);
    const {
        data: boards = [],
        isError: boardsError,
        isPending: boardsPending,
    } = useProjectBoards(projectId);
    const { labels } = useProjectLabels(projectId);
    const teamId = project?.team_id ?? "";
    const { data: team, isLoading: teamLoading } = useTeam(teamId);
    const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);
    const showAutoAssignToCreator =
        Boolean(teamId) &&
        !teamLoading &&
        !membersLoading &&
        isSoloTeam(
            countTeamPeople({
                hasOwner: Boolean(team?.owner_id),
                memberCount: members?.length ?? 0,
            })
        );
    const defaultBoardId = boards[0]?.id ?? "";
    const selectTask = useTasksUiStore((state) => state.selectTask);

    const [section, setSection] = useState<SettingsSection>("boards");

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const navItems = useMemo(() => {
        const items: {
            count: null | number;
            id: SettingsSection;
            label: string;
            visible: boolean;
        }[] = [
            {
                count: boardsPending || boardsError ? null : boards.length,
                id: "boards",
                label: t("settings.nav.boards"),
                visible: isSettled && canManageBoard,
            },
            {
                count: projectLabels.length,
                id: "labels",
                label: t("settings.nav.labels"),
                visible: isSettled && canManageBoard,
            },
        ];
        return items.filter((item) => item.visible);
    }, [
        boards.length,
        boardsError,
        boardsPending,
        canManageBoard,
        isSettled,
        projectLabels.length,
        t,
    ]);

    useEffect(() => {
        if (!navItems.some((item) => item.id === section) && navItems[0]) {
            setSection(navItems[0].id);
        }
    }, [navItems, section]);

    if (isLoading || accessLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (accessError) {
        return (
            <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const activeSection =
        navItems.find((item) => item.id === section)?.id ??
        navItems[0]?.id ??
        "boards";

    return (
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto px-4 py-4">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="truncate text-sm font-semibold">
                            {t("settings.title")}
                        </h1>
                        {project ? (
                            <span className="truncate font-mono text-meta text-muted-foreground">
                                {project.name}
                            </span>
                        ) : undefined}
                    </div>
                </div>

                {(canManageMembers || canView) && project?.team_id ? (
                    <Alert>
                        <AlertDescription className="flex flex-wrap items-center gap-2">
                            <span>{t("settings.membersMoved")}</span>
                            <Button
                                nativeButton={false}
                                render={
                                    <Link
                                        params={{ teamId: project.team_id }}
                                        to="/teams/$teamId/settings"
                                    />
                                }
                                size="sm"
                                variant="outline"
                            >
                                {t("settings.openTeamSettings")}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : undefined}

                <div className="flex flex-wrap gap-1">
                    {navItems.map((item) => {
                        const active = item.id === activeSection;
                        return (
                            <Button
                                key={item.id}
                                onClick={() => setSection(item.id)}
                                size="sm"
                                type="button"
                                variant={active ? "secondary" : "ghost"}
                            >
                                {item.label}
                                {item.count == undefined ? undefined : (
                                    <span className="font-mono text-meta text-muted-foreground tabular-nums">
                                        {item.count}
                                    </span>
                                )}
                            </Button>
                        );
                    })}
                </div>
            </header>

            {error || !project ? (
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                    <section
                        className="scroll-mt-4 rounded-xl border border-border p-4"
                        id={resolveProjectConnectHash()}
                    >
                        <h2 className="text-ui font-medium">
                            {t("settings.repository.title")}
                        </h2>
                        {projectHasGithubRepo(project.github_repo_id) ? (
                            <p className="mt-2 min-w-0 truncate font-mono text-code text-muted-foreground">
                                {project.github_full_name ??
                                    t("settings.repository.linked")}
                            </p>
                        ) : canManageSettings ? (
                            <ConnectProjectRepository
                                projectId={projectId}
                                teamId={project.team_id}
                            />
                        ) : (
                            <p className="mt-2 text-ui text-muted-foreground">
                                {t("settings.repository.connect")}
                            </p>
                        )}
                    </section>

                    {activeSection === "boards" &&
                    isSettled &&
                    canManageBoard ? (
                        <ProjectBoardsSettings
                            defaultBaseBranch={
                                project.github_default_branch ?? "main"
                            }
                            projectId={projectId}
                            showAutoAssignToCreator={showAutoAssignToCreator}
                        />
                    ) : undefined}
                    {activeSection === "labels" &&
                    isSettled &&
                    canManageBoard ? (
                        <ProjectLabelsSettings
                            onOpenTask={selectTask}
                            projectId={projectId}
                        />
                    ) : undefined}
                    {defaultBoardId ? (
                        <TaskDrawer
                            boardId={defaultBoardId}
                            githubToken={githubAccessToken}
                            projectId={projectId}
                            repoFullName={project.github_full_name ?? undefined}
                        />
                    ) : undefined}
                </div>
            )}
        </div>
    );
}
