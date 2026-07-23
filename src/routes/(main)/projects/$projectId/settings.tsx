import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/model/use-auth";
import { ProjectBoardsSettings, useProjectBoards } from "@/features/boards";
import { ProjectLabelsSettings, useProjectLabels } from "@/features/labels";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    useProjectInvites,
    useProjectMembers,
    useProjectOwnerProfile,
} from "@/features/projects/model/use-project-members";
import { useProject } from "@/features/projects/model/use-projects";
import { ProjectMembersSettings } from "@/features/projects/ui/project-members-settings";
import { TaskDrawer, useTasksUiStore } from "@/features/tasks";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export const Route = createFileRoute("/(main)/projects/$projectId/settings")({
    component: ProjectSettingsRoute,
});

type SettingsSection = "boards" | "labels" | "members";

function ProjectSettingsRoute() {
    const { projectId } = Route.useParams();
    const { t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const { data: project, error, isLoading } = useProject(projectId);
    const { canManageBoard, canManageMembers, canView } =
        useProjectAccess(projectId);
    const { data: boards = [] } = useProjectBoards(projectId);
    const { data: members = [] } = useProjectMembers(projectId);
    const { data: ownerProfile } = useProjectOwnerProfile(project?.owner_id);
    const { data: invites = [] } = useProjectInvites(
        projectId,
        canManageMembers
    );
    const { labels } = useProjectLabels(projectId);
    const defaultBoardId = boards[0]?.id ?? "";
    const selectTask = useTasksUiStore((state) => state.selectTask);

    const [section, setSection] = useState<SettingsSection>("members");

    const membersCount = useMemo(() => {
        const ownerCounted = project?.owner_id && ownerProfile ? 1 : 0;
        return ownerCounted + members.length;
    }, [members.length, ownerProfile, project?.owner_id]);

    const pendingInvitesCount = useMemo(
        () => invites.filter((invite) => invite.status === "pending").length,
        [invites]
    );

    const projectLabels = useMemo(
        () => labels.filter((label) => label.projectId === projectId),
        [labels, projectId]
    );

    const navItems = useMemo(() => {
        const items: {
            count: number;
            id: SettingsSection;
            label: string;
            visible: boolean;
        }[] = [
            {
                count: membersCount,
                id: "members",
                label: t("settings.nav.members"),
                visible: canManageMembers || canView,
            },
            {
                count: boards.length,
                id: "boards",
                label: t("settings.nav.boards"),
                visible: canManageBoard,
            },
            {
                count: projectLabels.length,
                id: "labels",
                label: t("settings.nav.labels"),
                visible: canManageBoard,
            },
        ];
        return items.filter((item) => item.visible);
    }, [
        boards.length,
        canManageBoard,
        canManageMembers,
        canView,
        membersCount,
        projectLabels.length,
        t,
    ]);

    useEffect(() => {
        if (!navItems.some((item) => item.id === section) && navItems[0]) {
            setSection(navItems[0].id);
        }
    }, [navItems, section]);

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    const activeSection =
        navItems.find((item) => item.id === section)?.id ??
        navItems[0]?.id ??
        "members";

    return (
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto px-4 py-4">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                            className="shrink-0 text-muted-foreground"
                            nativeButton={false}
                            render={
                                <Link
                                    params={{ projectId }}
                                    to="/projects/$projectId"
                                />
                            }
                            size="sm"
                            variant="ghost"
                        >
                            <ArrowLeft data-icon="inline-start" />
                            {t("settings.backToBoard")}
                        </Button>
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

                <div className="flex flex-wrap gap-1">
                    {navItems.map((item) => {
                        const active = item.id === activeSection;
                        const showPendingBadge =
                            item.id === "members" &&
                            canManageMembers &&
                            pendingInvitesCount > 0;
                        return (
                            <Button
                                key={item.id}
                                onClick={() => setSection(item.id)}
                                size="sm"
                                type="button"
                                variant={active ? "secondary" : "ghost"}
                            >
                                {item.label}
                                <span className="font-mono text-meta text-muted-foreground tabular-nums">
                                    {item.count}
                                </span>
                                {showPendingBadge ? (
                                    <span className="rounded-sm bg-amber-500/20 px-1.5 font-mono text-[0.625rem] text-amber-400 tabular-nums">
                                        {pendingInvitesCount}
                                    </span>
                                ) : undefined}
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
                <div className="mx-auto w-full max-w-3xl">
                    {activeSection === "members" ? (
                        <ProjectMembersSettings projectId={projectId} />
                    ) : undefined}
                    {activeSection === "boards" && canManageBoard ? (
                        <ProjectBoardsSettings
                            defaultBaseBranch={
                                project.github_default_branch ?? "main"
                            }
                            projectId={projectId}
                        />
                    ) : undefined}
                    {activeSection === "labels" && canManageBoard ? (
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
                            repoFullName={project.github_full_name}
                        />
                    ) : undefined}
                </div>
            )}
        </div>
    );
}
