import { Link } from "@tanstack/react-router";
import { ArrowLeft, ListChecks, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";
import { GUEST_SEED_ACTOR_ID, isGuest } from "@/features/guest-mode";
import { useProjectsByTeam } from "@/features/projects/model/use-projects";
import { type TeamTask, useTeamTasks } from "@/features/tasks";
import { useTeamAccess } from "@/features/teams";
import { useTeam } from "@/features/teams/model/use-team-members";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/shared/shadcn/ui/empty";
import {
    ANY_ASSIGNEE_FILTER,
    buildTeamTasksGroups,
    ME_ASSIGNEE_FILTER,
    type TeamTasksPreferences,
    UNASSIGNED_ASSIGNEE_FILTER,
} from "@/widgets/team-tasks/model/team-tasks-view";
import {
    resolveTeamTasksPreferences,
    useTeamTasksViewStore,
} from "@/widgets/team-tasks/model/team-tasks-view-store";

import { TeamTaskCreateDialog } from "./team-task-create-dialog";
import { TeamTasksList } from "./team-tasks-list";
import { TeamTasksLoading } from "./team-tasks-loading";
import {
    TeamTasksToolbar,
    type TeamTasksToolbarPerson,
} from "./team-tasks-toolbar";

type TeamTasksPageProperties = {
    teamId: string;
};

const NO_TASKS: TeamTask[] = [];

const ASSIGNEE_SENTINELS = new Set<string>([
    ANY_ASSIGNEE_FILTER,
    ME_ASSIGNEE_FILTER,
    UNASSIGNED_ASSIGNEE_FILTER,
]);

/** Team Tasks — every Task across the Team's Projects in one read-first list. */
export function TeamTasksPage({ teamId }: TeamTasksPageProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const currentUserId = isGuest() ? GUEST_SEED_ACTOR_ID : user?.id;
    const {
        data: team,
        error: teamError,
        isLoading: teamLoading,
    } = useTeam(teamId);
    const {
        canCreateTasks,
        canView,
        isError: accessError,
        isLoading: accessLoading,
        isSettled,
    } = useTeamAccess(teamId);
    const {
        data: projects = [],
        error: projectsError,
        isLoading: projectsLoading,
    } = useProjectsByTeam(teamId);
    const tasksQuery = useTeamTasks(teamId, isSettled && canView);
    const tasks = tasksQuery.data ?? NO_TASKS;

    const storedPreferences = useTeamTasksViewStore(
        (state) => state.byTeamId[teamId]
    );
    const setPreferences = useTeamTasksViewStore(
        (state) => state.setPreferences
    );
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const people = useMemo(
        () => collectAssignees(tasks, currentUserId),
        [currentUserId, tasks]
    );

    // Persisted ids can outlive their Project or the Assignee's last Task —
    // drop them for display instead of filtering the list down to nothing.
    const preferences = useMemo<TeamTasksPreferences>(() => {
        const resolved = resolveTeamTasksPreferences(storedPreferences);
        const projectIds = resolved.projectIds.filter((id) =>
            projects.some((project) => project.id === id)
        );
        const assigneeKnown =
            ASSIGNEE_SENTINELS.has(resolved.assignee) ||
            people.some((person) => person.id === resolved.assignee);
        return {
            ...resolved,
            assignee: assigneeKnown ? resolved.assignee : ANY_ASSIGNEE_FILTER,
            projectIds,
        };
    }, [people, projects, storedPreferences]);

    const groups = useMemo(
        () => buildTeamTasksGroups(tasks, preferences, { currentUserId }),
        [currentUserId, preferences, tasks]
    );
    const visibleCount = groups.reduce(
        (total, group) => total + group.tasks.length,
        0
    );

    const isLoading =
        teamLoading ||
        accessLoading ||
        projectsLoading ||
        (!isSettled && !accessError && !teamError);

    if (isLoading) {
        return <TeamTasksLoading />;
    }

    if (accessError || teamError || !team || (isSettled && !canView)) {
        return (
            <div className="px-4 py-8">
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("teamTasks.teamLoadFailed")}
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const canCreate = canCreateTasks && projects.length > 0;
    const newTaskButton = canCreate ? (
        <Button onClick={() => setIsCreateOpen(true)} type="button">
            <Plus data-icon="inline-start" />
            {t("teamTasks.newTask")}
        </Button>
    ) : undefined;

    return (
        <div className="flex min-w-0 flex-col gap-6 px-4 py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <Button
                        className="-ml-2.5 w-fit max-w-full text-muted-foreground"
                        nativeButton={false}
                        render={
                            <Link params={{ teamId }} to="/teams/$teamId" />
                        }
                        size="sm"
                        variant="ghost"
                    >
                        <ArrowLeft data-icon="inline-start" />
                        <span className="min-w-0 truncate">{team.name}</span>
                    </Button>
                    <h1 className="truncate">{t("teamTasks.title")}</h1>
                    <p className="text-body text-muted-foreground">
                        {t("teamTasks.subtitle")}
                    </p>
                </div>
                {newTaskButton}
            </div>

            <div className="flex flex-col gap-3">
                <TeamTasksToolbar
                    onChange={(patch) => {
                        setPreferences(teamId, patch);
                    }}
                    people={people}
                    preferences={preferences}
                    projects={projects}
                />
                {tasksQuery.data ? (
                    <p
                        aria-live="polite"
                        className="font-mono text-meta text-muted-foreground tabular-nums"
                    >
                        {t("teamTasks.count", { count: visibleCount })}
                    </p>
                ) : undefined}
            </div>

            {projectsError || tasksQuery.isError ? (
                <Alert variant="destructive">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                        {t("teamTasks.loadFailed")}
                        <Button
                            onClick={() => {
                                void tasksQuery.refetch();
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("teamTasks.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : tasksQuery.data === undefined ? (
                <TeamTasksLoading variant="rows" />
            ) : tasks.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ListChecks />
                        </EmptyMedia>
                        <EmptyTitle>{t("teamTasks.empty.title")}</EmptyTitle>
                        <EmptyDescription>
                            {projects.length === 0
                                ? t("teamTasks.empty.noProjects")
                                : t("teamTasks.empty.description")}
                        </EmptyDescription>
                    </EmptyHeader>
                    {newTaskButton ? (
                        <EmptyContent>{newTaskButton}</EmptyContent>
                    ) : undefined}
                </Empty>
            ) : visibleCount === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ListChecks />
                        </EmptyMedia>
                        <EmptyTitle>
                            {t("teamTasks.emptyFiltered.title")}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t("teamTasks.emptyFiltered.description")}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            onClick={() => {
                                setPreferences(teamId, {
                                    assignee: ANY_ASSIGNEE_FILTER,
                                    hideDone: false,
                                    projectIds: [],
                                });
                            }}
                            type="button"
                            variant="outline"
                        >
                            {t("teamTasks.emptyFiltered.showAll")}
                        </Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <TeamTasksList groups={groups} />
            )}

            {canCreate ? (
                <TeamTaskCreateDialog
                    onOpenChange={setIsCreateOpen}
                    open={isCreateOpen}
                    projects={projects}
                    teamId={teamId}
                />
            ) : undefined}
        </div>
    );
}

/** Assignees present in the list, by name — the viewer is covered by "Me". */
function collectAssignees(
    tasks: TeamTask[],
    currentUserId: string | undefined
): TeamTasksToolbarPerson[] {
    const people = new Map<string, TeamTasksToolbarPerson>();
    for (const task of tasks) {
        const assignee = task.assignee;
        if (!assignee || assignee.id === currentUserId) continue;
        people.set(assignee.id, { id: assignee.id, name: assignee.name });
    }
    return [...people.values()].toSorted((left, right) =>
        left.name.localeCompare(right.name)
    );
}
