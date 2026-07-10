import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { signInWithGitHub } from "@/features/auth";
import type { GitHubRepo, Project } from "@/features/projects/model/types";
import { GitHubMissingRepoScopeError } from "@/features/projects/api/github-api";

import { useCreateProject } from "@/features/projects/model/use-projects";
import { useGitHubRepos } from "@/features/projects/model/use-github-repos";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type AddProjectDialogProps = {
    accessToken: null | string;
    connectedProjects: Project[];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    userId: string;
};

export function AddProjectDialog({
    accessToken,
    connectedProjects,
    onOpenChange,
    open,
    userId,
}: AddProjectDialogProps) {
    const { t } = useTranslation("home");
    const [search, setSearch] = useState("");
    const createProject = useCreateProject();
    const {
        data: repos = [],
        error,
        isLoading,
    } = useGitHubRepos(accessToken, userId);

    const connectedRepoIds = useMemo(
        () => new Set(connectedProjects.map((project) => project.github_repo_id)),
        [connectedProjects],
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

    const handleConnect = async (repo: GitHubRepo) => {
        await createProject.mutateAsync(repo);
        onOpenChange(false);
    };

    const handleReconnectGitHub = async () => {
        await signInWithGitHub();
    };

    const missingRepoScope = error instanceof GitHubMissingRepoScopeError;

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="flex max-h-[min(80vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="border-b border-border px-4 py-3">
                    <DialogTitle className="font-display text-lg">
                        {t("addProjectTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("addProjectSubtitle")}
                    </DialogDescription>
                </DialogHeader>

                <div className="border-b border-border px-4 py-3">
                    <Input
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t("searchRepos")}
                        type="search"
                        value={search}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                            <Spinner />
                            {t("loadingRepos")}
                        </div>
                    )}

                    {error && (
                        <Alert className="mx-2" variant="destructive">
                            <AlertDescription className="flex flex-col gap-3">
                                <span>
                                    {missingRepoScope
                                        ? t("reposScopeError")
                                        : t("reposError")}
                                </span>
                                {missingRepoScope && (
                                    <Button
                                        className="self-start"
                                        onClick={handleReconnectGitHub}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {t("reconnectGitHub")}
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {!isLoading && !error && availableRepos.length === 0 && (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                            {t("noReposFound")}
                        </p>
                    )}

                    <ul className="flex flex-col gap-1">
                        {availableRepos.map((repo) => (
                            <li key={repo.id}>
                                <Button
                                    className="h-auto w-full justify-between px-3 py-2.5 text-left"
                                    disabled={createProject.isPending}
                                    onClick={() => handleConnect(repo)}
                                    type="button"
                                    variant="ghost"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate font-medium">
                                                {repo.name}
                                            </span>
                                            {repo.private && (
                                                <Lock
                                                    aria-hidden
                                                    className="size-3 shrink-0 text-muted-foreground"
                                                />
                                            )}
                                        </div>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {repo.full_name}
                                        </p>
                                        {repo.description && (
                                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                                {repo.description}
                                            </p>
                                        )}
                                    </div>
                                    <Plus className="shrink-0 text-primary" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}
