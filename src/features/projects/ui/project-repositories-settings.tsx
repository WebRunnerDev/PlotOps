import { ExternalLink, GitBranch, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { GithubAppInstallationStatus } from "@/features/projects/api/github-app-status-api";
import type {
    Project,
    ProjectRepository,
} from "@/features/projects/model/types";

import {
    canAddRepositoryToProject,
    PROJECT_REPOSITORIES_CAP,
} from "@/features/projects/model/limits";
import { resolveProjectConnectHash } from "@/features/projects/model/project-github-gate";
import { useGithubAppStatus } from "@/features/projects/model/use-github-app-status";
import {
    useRemoveProjectRepository,
    useRepositoryGitLinkCount,
} from "@/features/projects/model/use-projects";
import { ConnectProjectRepository } from "@/features/projects/ui/connect-project-repository";
import { cn } from "@/shared/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type ProjectRepositoriesSettingsProperties = {
    /** Owner/Admin — link and unlink (ADR 0035). */
    canManage: boolean;
    /**
     * Guest Mode links and unlinks in the sandbox, uncapped (ADR 0035), and
     * has no GitHub App to report on.
     */
    isGuest: boolean;
    project: Project;
};

/**
 * Project Settings → Repositories: the Project's linked GitHub repositories,
 * GitHub App status per Repository, and Admin+ link / unlink (ADR 0035).
 */
export function ProjectRepositoriesSettings({
    canManage,
    isGuest,
    project,
}: ProjectRepositoriesSettingsProperties) {
    const { t } = useTranslation("board");
    const repositories = project.repositories;
    const count = repositories.length;
    const canEdit = canManage;
    const canAdd = canAddRepositoryToProject(count, { isGuest });
    const [pickerOpen, setPickerOpen] = useState(false);
    const [unlinking, setUnlinking] = useState<null | ProjectRepository>(null);
    const appStatus = useGithubAppStatus(project.id, !isGuest && count > 0);
    const installUrl = appStatus.data?.installUrl ?? null;
    const showPicker = canEdit && canAdd && (pickerOpen || count === 0);

    return (
        <section
            className={cn(
                "scroll-mt-4 motion-reveal border border-border bg-card/60 p-5 backdrop-blur-sm [animation-delay:220ms] sm:p-6",
                count > 0 ? "ring-1 ring-primary/20" : "border-dashed"
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
                    <span className="font-mono text-meta text-muted-foreground tabular-nums">
                        {isGuest
                            ? count
                            : t("settings.repository.capCount", {
                                  cap: PROJECT_REPOSITORIES_CAP,
                                  count,
                              })}
                    </span>
                </div>
                {canEdit && count > 0 ? (
                    <Button
                        disabled={!canAdd}
                        onClick={() => setPickerOpen((open) => !open)}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {pickerOpen && canAdd ? (
                            <X data-icon="inline-start" />
                        ) : (
                            <Plus data-icon="inline-start" />
                        )}
                        {pickerOpen && canAdd
                            ? t("settings.repository.closePicker")
                            : t("settings.repository.add")}
                    </Button>
                ) : undefined}
            </div>

            {count === 0 ? (
                <p className="mt-4 max-w-prose text-ui text-muted-foreground">
                    {t("settings.repository.connect")}
                </p>
            ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border border border-border bg-background/40">
                    {repositories.map((repository) => (
                        <RepositoryRow
                            canUnlink={canEdit}
                            installUrl={installUrl}
                            isGuest={isGuest}
                            key={repository.id}
                            onUnlink={() => setUnlinking(repository)}
                            repository={repository}
                            status={
                                appStatus.isPending || appStatus.isError
                                    ? appStatus.isError
                                        ? "unknown"
                                        : "loading"
                                    : (appStatus.data?.statuses[
                                          repository.id
                                      ] ?? "unknown")
                            }
                        />
                    ))}
                </ul>
            )}

            {canEdit && !canAdd ? (
                <p className="mt-3 text-meta text-muted-foreground">
                    {t("settings.repository.capReached", {
                        count: PROJECT_REPOSITORIES_CAP,
                    })}
                </p>
            ) : undefined}

            {showPicker ? (
                <div className="mt-4">
                    <ConnectProjectRepository
                        onAdded={() => setPickerOpen(false)}
                        projectId={project.id}
                        teamId={project.team_id}
                    />
                </div>
            ) : undefined}

            <UnlinkRepositoryDialog
                onClose={() => setUnlinking(null)}
                projectId={project.id}
                repository={unlinking}
            />
        </section>
    );
}

function AppStatusBadge({
    installUrl,
    status,
}: {
    installUrl: null | string;
    status: "loading" | GithubAppInstallationStatus;
}) {
    const { t } = useTranslation("board");

    if (status === "loading") {
        return (
            <span className="inline-flex items-center gap-1.5 font-mono text-meta text-muted-foreground">
                <Spinner className="size-3" />
                {t("settings.repository.appChecking")}
            </span>
        );
    }

    const tone = {
        installed: "text-success",
        not_installed: "text-warning",
        unknown: "text-muted-foreground",
    }[status];
    const dot = {
        installed: "bg-success",
        not_installed: "bg-warning",
        unknown: "bg-muted-foreground/50",
    }[status];
    const label = {
        installed: t("settings.repository.appInstalled"),
        not_installed: t("settings.repository.appNotInstalled"),
        unknown: t("settings.repository.appUnknown"),
    }[status];

    return (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
                className={cn(
                    "inline-flex items-center gap-1.5 font-mono text-meta uppercase tracking-[0.12em]",
                    tone
                )}
            >
                <span
                    aria-hidden
                    className={cn("size-1.5 shrink-0 rounded-full", dot)}
                />
                {label}
            </span>
            {status !== "installed" && installUrl ? (
                <a
                    className="inline-flex items-center gap-1 text-meta text-primary underline-offset-4 hover:underline"
                    href={installUrl}
                    rel="noreferrer"
                    target="_blank"
                >
                    {t("settings.repository.appInstall")}
                    <ExternalLink aria-hidden className="size-3" />
                </a>
            ) : undefined}
        </span>
    );
}

function RepositoryRow({
    canUnlink,
    installUrl,
    isGuest,
    onUnlink,
    repository,
    status,
}: {
    canUnlink: boolean;
    installUrl: null | string;
    isGuest: boolean;
    onUnlink: () => void;
    repository: ProjectRepository;
    status: "loading" | GithubAppInstallationStatus;
}) {
    const { t } = useTranslation("board");

    return (
        <li className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a
                    className="min-w-0 truncate font-mono text-code text-foreground/90 underline-offset-4 hover:text-primary hover:underline"
                    href={repository.github_html_url}
                    rel="noreferrer"
                    target="_blank"
                >
                    {repository.github_full_name}
                </a>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-meta normal-case text-muted-foreground">
                        {t("settings.repository.defaultBranch", {
                            branch: repository.github_default_branch,
                        })}
                    </span>
                    {isGuest ? undefined : (
                        <AppStatusBadge
                            installUrl={installUrl}
                            status={status}
                        />
                    )}
                </div>
            </div>
            {canUnlink ? (
                <Button
                    aria-label={t("settings.repository.unlinkLabel", {
                        repository: repository.github_full_name,
                    })}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={onUnlink}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <Trash2 data-icon="inline-start" />
                    {t("settings.repository.unlink")}
                </Button>
            ) : undefined}
        </li>
    );
}

function UnlinkRepositoryDialog({
    onClose,
    projectId,
    repository,
}: {
    onClose: () => void;
    projectId: string;
    repository: null | ProjectRepository;
}) {
    const { t } = useTranslation("board");
    const remove = useRemoveProjectRepository(projectId);
    const linkCount = useRepositoryGitLinkCount(repository?.id ?? null);
    const counting = linkCount.isPending;

    const handleUnlink = async () => {
        if (!repository) return;
        try {
            await remove.mutateAsync(repository.id);
            toast.success(
                t("settings.repository.unlinkSuccess", {
                    repository: repository.github_full_name,
                })
            );
            onClose();
        } catch {
            toast.error(t("settings.repository.unlinkFailed"));
        }
    };

    return (
        <AlertDialog
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            open={Boolean(repository)}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t("settings.repository.unlinkTitle", {
                            repository: repository?.github_full_name ?? "",
                        })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {counting
                            ? t("settings.repository.unlinkCounting")
                            : linkCount.isError
                              ? t("settings.repository.unlinkCountFailed")
                              : t("settings.repository.unlinkDescription", {
                                    count: linkCount.data ?? 0,
                                })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("boards.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={counting || remove.isPending}
                        onClick={() => void handleUnlink()}
                        variant="destructive"
                    >
                        {remove.isPending ? (
                            <Spinner data-icon="inline-start" />
                        ) : (
                            <Trash2 data-icon="inline-start" />
                        )}
                        {t("settings.repository.unlinkConfirm")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
