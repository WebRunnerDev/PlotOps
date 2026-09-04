import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
    ArrowLeft,
    Columns3,
    GitBranch,
    type LucideIcon,
    SlidersHorizontal,
    Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import {
    countTeamPeople,
    isSoloTeam,
    ProjectBoardsSettings,
    useProjectBoards,
} from "@/features/boards";
import {
    ProjectCustomFieldsSettings,
    useProjectCustomFields,
} from "@/features/custom-fields";
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
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/(main)/projects/$projectId/settings")({
    component: ProjectSettingsRoute,
});

type SettingsSection = "boards" | "customFields" | "labels";

const SECTION_ICONS = {
    boards: Columns3,
    customFields: SlidersHorizontal,
    labels: Tag,
} as const satisfies Record<SettingsSection, LucideIcon>;

function ProjectSettingsRoute() {
    const { projectId } = Route.useParams();
    const router = useRouter();
    const { t } = useTranslation("board");
    const { t: tCommon } = useTranslation("common");
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
    const { fields: customFields } = useProjectCustomFields(projectId);
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
            {
                count: customFields.length,
                id: "customFields",
                label: t("settings.nav.customFields"),
                visible: isSettled && canManageBoard,
            },
        ];
        return items.filter((item) => item.visible);
    }, [
        boards.length,
        boardsError,
        boardsPending,
        canManageBoard,
        customFields.length,
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
            <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col gap-4 px-4 py-8">
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
    const repoLinked = project
        ? projectHasGithubRepo(project.github_repo_id)
        : false;

    return (
        <div className="relative mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-8 overflow-y-auto px-4 py-8 sm:gap-10 sm:py-10">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-auth-atmosphere opacity-80 sm:-top-10 sm:h-96"
            />

            <header className="relative flex min-w-0 flex-col gap-5 motion-reveal sm:gap-6">
                <Button
                    className="w-fit shrink-0 text-muted-foreground"
                    onClick={() => router.history.back()}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <ArrowLeft data-icon="inline-start" />
                    {tCommon("back")}
                </Button>

                <div className="flex min-w-0 flex-col gap-3">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                        {t("settings.nav.projectSettings")}
                    </p>
                    <h1 className="min-w-0 truncate text-h1 text-foreground">
                        {project?.name ?? t("settings.title")}
                    </h1>
                    <div aria-hidden className="h-px w-14 bg-primary/70" />
                    <p className="max-w-xl text-body text-muted-foreground">
                        {t("settings.description")}
                    </p>
                </div>

                {(canManageMembers || canView) && project?.team_id ? (
                    <Alert className="motion-reveal max-w-2xl [animation-delay:120ms]">
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
            </header>

            {error || !project ? (
                <Alert className="relative" variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            ) : (
                <div className="relative grid min-w-0 gap-8 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,1fr)]">
                    {navItems.length > 0 ? (
                        <nav
                            aria-label={t("settings.nav.projectSettings")}
                            className="motion-reveal min-w-0 [animation-delay:160ms] lg:sticky lg:top-4 lg:self-start"
                        >
                            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                                {navItems.map((item, index) => {
                                    const active = item.id === activeSection;
                                    const Icon = SECTION_ICONS[item.id];
                                    return (
                                        <li
                                            className="shrink-0 lg:w-full"
                                            key={item.id}
                                        >
                                            <button
                                                aria-current={
                                                    active ? "page" : undefined
                                                }
                                                className={cn(
                                                    "group flex w-full min-w-0 items-center gap-2.5 border border-transparent px-3 py-2.5 text-left transition-[color,background-color,border-color,transform] duration-300 ease-(--ease-out-expo)",
                                                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                                    active
                                                        ? "border-border bg-card text-foreground shadow-[inset_3px_0_0_0_var(--primary)]"
                                                        : "text-muted-foreground hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
                                                )}
                                                onClick={() =>
                                                    setSection(item.id)
                                                }
                                                style={{
                                                    transitionDelay: `${index * 40}ms`,
                                                }}
                                                type="button"
                                            >
                                                <Icon
                                                    aria-hidden
                                                    className={cn(
                                                        "size-3.5 shrink-0 transition-transform duration-300 ease-(--ease-out-expo)",
                                                        active
                                                            ? "text-primary"
                                                            : "text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary"
                                                    )}
                                                />
                                                <span className="min-w-0 flex-1 truncate text-ui">
                                                    {item.label}
                                                </span>
                                                {item.count ==
                                                undefined ? undefined : (
                                                    <span
                                                        className={cn(
                                                            "font-mono text-meta tabular-nums",
                                                            active
                                                                ? "text-primary/80"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {String(
                                                            item.count
                                                        ).padStart(2, "0")}
                                                    </span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>
                    ) : undefined}

                    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8 lg:mx-0 lg:max-w-none">
                        <section
                            className={cn(
                                "scroll-mt-4 motion-reveal border border-border bg-card/60 p-5 backdrop-blur-sm [animation-delay:220ms] sm:p-6",
                                repoLinked
                                    ? "ring-1 ring-primary/20"
                                    : "border-dashed"
                            )}
                            id={resolveProjectConnectHash()}
                        >
                            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <GitBranch
                                        aria-hidden
                                        className="size-4 shrink-0 text-primary"
                                    />
                                    <h2 className="text-h3">
                                        {t("settings.repository.title")}
                                    </h2>
                                </div>
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-2 font-mono text-meta uppercase tracking-[0.12em]",
                                        repoLinked
                                            ? "text-success"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "size-1.5 shrink-0 rounded-full",
                                            repoLinked
                                                ? "bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_28%,transparent)]"
                                                : "bg-muted-foreground/50"
                                        )}
                                    />
                                    {repoLinked
                                        ? t("settings.repository.statusLinked")
                                        : t(
                                              "settings.repository.statusUnlinked"
                                          )}
                                </span>
                            </div>

                            {repoLinked ? (
                                <p className="mt-4 min-w-0 truncate font-mono text-code text-foreground/90">
                                    {project.github_full_name ??
                                        t("settings.repository.linked")}
                                </p>
                            ) : canManageSettings ? (
                                <ConnectProjectRepository
                                    projectId={projectId}
                                    teamId={project.team_id}
                                />
                            ) : (
                                <p className="mt-4 text-ui text-muted-foreground">
                                    {t("settings.repository.connect")}
                                </p>
                            )}
                        </section>

                        <div
                            className="motion-reveal min-w-0 [animation-delay:300ms]"
                            key={activeSection}
                        >
                            {activeSection === "boards" &&
                            isSettled &&
                            canManageBoard ? (
                                <ProjectBoardsSettings
                                    defaultBaseBranch={
                                        project.github_default_branch ?? "main"
                                    }
                                    projectId={projectId}
                                    showAutoAssignToCreator={
                                        showAutoAssignToCreator
                                    }
                                    showGitBranchSettings={repoLinked}
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
                            {activeSection === "customFields" &&
                            isSettled &&
                            canManageBoard ? (
                                <ProjectCustomFieldsSettings
                                    onOpenTask={selectTask}
                                    projectId={projectId}
                                />
                            ) : undefined}
                        </div>

                        {defaultBoardId ? (
                            <TaskDrawer
                                boardId={defaultBoardId}
                                githubToken={githubAccessToken}
                                projectId={projectId}
                                repoFullName={
                                    project.github_full_name ?? undefined
                                }
                            />
                        ) : undefined}
                    </div>
                </div>
            )}
        </div>
    );
}
