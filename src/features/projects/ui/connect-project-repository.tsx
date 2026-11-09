import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { GitHubRepo, Project } from "@/features/projects/model/types";

import { signInWithGitHub, useAuth } from "@/features/auth";
import { useIsGuest } from "@/features/guest-mode";
import { GitHubMissingRepoScopeError } from "@/features/projects/api/github-api";
import { isUniqueViolation } from "@/features/projects/lib/is-unique-violation";
import { PROJECT_REPOSITORIES_CAP } from "@/features/projects/model/limits";
import { resolveRepoAddNamePrompt } from "@/features/projects/model/resolve-repo-add-name-prompt";
import { useGitHubRepos } from "@/features/projects/model/use-github-repos";
import {
    useAddProjectRepository,
    useProjectsByTeam,
    useRenameProject,
} from "@/features/projects/model/use-projects";
import { isCapExceeded } from "@/shared/lib/is-cap-exceeded";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type ConnectProjectRepositoryProperties = {
    /** Called after a Repository is linked (e.g. to close the picker). */
    onAdded?: () => void;
    project: Pick<Project, "id" | "name" | "repositories" | "team_id">;
};

/**
 * Picker of the viewer's GitHub repositories, minus those already linked to
 * any Project in the Team (a repository belongs to one Project per Team).
 * When the pick makes a Project multi-repo while it still carries its first
 * repo's name, it asks for a Project name first and says why.
 */
export function ConnectProjectRepository({
    onAdded,
    project,
}: ConnectProjectRepositoryProperties) {
    const projectId = project.id;
    const teamId = project.team_id;
    const { t } = useTranslation("board");
    const { githubAccessToken, user } = useAuth();
    const guest = useIsGuest();
    const [search, setSearch] = useState("");
    const connect = useAddProjectRepository(projectId);
    const rename = useRenameProject(projectId);
    const nameSource = resolveRepoAddNamePrompt(project);
    const [pendingRepo, setPendingRepo] = useState<GitHubRepo | null>(null);
    const [newName, setNewName] = useState("");
    const { data: teamProjects = [] } = useProjectsByTeam(teamId);
    const {
        data: repos = [],
        error,
        isLoading,
    } = useGitHubRepos(githubAccessToken, user?.id);

    const connectedRepoIds = useMemo(
        () =>
            new Set(
                teamProjects.flatMap((project) =>
                    project.repositories.map((repo) => repo.github_repo_id)
                )
            ),
        [teamProjects]
    );

    const availableRepos = useMemo(() => {
        const query = search.trim().toLowerCase();

        return repos
            .filter((repo) => !connectedRepoIds.has(repo.id))
            .filter((repo) => {
                if (!query) return true;
                return (
                    repo.full_name.toLowerCase().includes(query) ||
                    repo.description?.toLowerCase().includes(query)
                );
            });
    }, [connectedRepoIds, repos, search]);

    const handlePick = (repo: GitHubRepo) => {
        if (nameSource) {
            setNewName("");
            setPendingRepo(repo);
            return;
        }
        void handleConnect(repo);
    };

    const handleConnect = async (repo: GitHubRepo, name?: string) => {
        try {
            await connect.mutateAsync(repo);
            setPendingRepo(null);
            toast.success(
                t("settings.repository.connectSuccess", {
                    repository: repo.full_name,
                })
            );
            if (name) {
                try {
                    await rename.mutateAsync(name);
                } catch {
                    toast.error(t("settings.repository.renameFailed"));
                }
            }
            onAdded?.();
        } catch (connectError) {
            toast.error(
                isUniqueViolation(connectError)
                    ? t("settings.repository.connectDuplicate")
                    : isCapExceeded(connectError, "project_repositories_cap")
                      ? t("settings.repository.capReached", {
                            count: PROJECT_REPOSITORIES_CAP,
                        })
                      : t("settings.repository.connectFailed")
            );
        }
    };

    const missingRepoScope = error instanceof GitHubMissingRepoScopeError;
    // Guest Mode lists the fake demo account's repositories, no token needed.
    const hasGitHubToken = guest || Boolean(githubAccessToken);

    if (!hasGitHubToken) {
        return (
            <div className="flex flex-col gap-3">
                <Alert>
                    <AlertDescription>
                        {t("settings.repository.githubRequired")}
                    </AlertDescription>
                </Alert>
                <Button
                    className="self-start"
                    onClick={() => {
                        void signInWithGitHub();
                    }}
                    type="button"
                    variant="outline"
                >
                    {t("settings.repository.reconnectGitHub")}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <Input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("settings.repository.searchRepos")}
                type="search"
                value={search}
            />

            <ScrollArea className="h-72 border border-border bg-background/40">
                <div className="p-1 pr-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-ui text-muted-foreground">
                            <Spinner />
                            {t("settings.repository.loadingRepos")}
                        </div>
                    ) : undefined}

                    {error ? (
                        <Alert className="m-2" variant="destructive">
                            <AlertDescription className="flex flex-col gap-3">
                                <span>
                                    {missingRepoScope
                                        ? t(
                                              "settings.repository.reposScopeError"
                                          )
                                        : t("settings.repository.reposError")}
                                </span>
                                {missingRepoScope ? (
                                    <Button
                                        className="self-start"
                                        onClick={() => {
                                            void signInWithGitHub();
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {t(
                                            "settings.repository.reconnectGitHub"
                                        )}
                                    </Button>
                                ) : undefined}
                            </AlertDescription>
                        </Alert>
                    ) : undefined}

                    {!isLoading && !error && availableRepos.length === 0 ? (
                        <p className="px-3 py-8 text-center text-ui text-muted-foreground">
                            {t("settings.repository.noReposFound")}
                        </p>
                    ) : undefined}

                    <ul className="flex flex-col gap-0.5">
                        {availableRepos.map((repo) => (
                            <li key={repo.id}>
                                <Button
                                    className="h-auto w-full justify-between rounded-none px-3 py-2.5 text-left transition-[background-color,transform] duration-300 ease-(--ease-out-expo) hover:translate-x-0.5"
                                    disabled={
                                        connect.isPending || rename.isPending
                                    }
                                    onClick={() => handlePick(repo)}
                                    type="button"
                                    variant="ghost"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate font-medium">
                                                {repo.name}
                                            </span>
                                            {repo.private ? (
                                                <Lock
                                                    aria-hidden
                                                    className="size-3 shrink-0 text-muted-foreground"
                                                />
                                            ) : undefined}
                                        </div>
                                        <p className="min-w-0 truncate font-mono text-code text-muted-foreground">
                                            {repo.full_name}
                                        </p>
                                        {repo.description ? (
                                            <p className="mt-1 line-clamp-1 text-ui font-normal text-muted-foreground">
                                                {repo.description}
                                            </p>
                                        ) : undefined}
                                    </div>
                                    {connect.isPending ? (
                                        <Spinner className="shrink-0" />
                                    ) : (
                                        <Plus className="shrink-0 text-primary" />
                                    )}
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </ScrollArea>

            <Dialog
                onOpenChange={(open) => {
                    if (!open && !(connect.isPending || rename.isPending))
                        setPendingRepo(null);
                }}
                open={pendingRepo !== null}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t("settings.repository.namePromptTitle", {
                                repository: pendingRepo?.full_name ?? "",
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t("settings.repository.namePromptReason", {
                                name: project.name,
                                source: nameSource ?? "",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="flex flex-col gap-1.5"
                        id="repo-add-project-name"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!pendingRepo || !newName.trim()) return;
                            void handleConnect(pendingRepo, newName.trim());
                        }}
                    >
                        <Label htmlFor="repo-add-project-name-input">
                            {t("settings.repository.namePromptLabel")}
                        </Label>
                        <Input
                            autoFocus
                            disabled={connect.isPending || rename.isPending}
                            id="repo-add-project-name-input"
                            onChange={(event) => setNewName(event.target.value)}
                            placeholder={t(
                                "settings.repository.namePromptPlaceholder"
                            )}
                            value={newName}
                        />
                    </form>
                    <DialogFooter>
                        <Button
                            disabled={connect.isPending || rename.isPending}
                            onClick={() => {
                                if (pendingRepo)
                                    void handleConnect(pendingRepo);
                            }}
                            type="button"
                            variant="ghost"
                        >
                            {t("settings.repository.namePromptKeep", {
                                name: project.name,
                            })}
                        </Button>
                        <Button
                            disabled={
                                connect.isPending ||
                                rename.isPending ||
                                !newName.trim()
                            }
                            form="repo-add-project-name"
                            type="submit"
                        >
                            {t("settings.repository.namePromptConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
