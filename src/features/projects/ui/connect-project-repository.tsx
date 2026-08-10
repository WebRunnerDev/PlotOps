import { Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { GitHubRepo } from "@/features/projects/model/types";

import { signInWithGitHub, useAuth } from "@/features/auth";
import { GitHubMissingRepoScopeError } from "@/features/projects/api/github-api";
import { isUniqueViolation } from "@/features/projects/lib/is-unique-violation";
import { useGitHubRepos } from "@/features/projects/model/use-github-repos";
import {
    useConnectProjectGithub,
    useProjectsByTeam,
} from "@/features/projects/model/use-projects";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type ConnectProjectRepositoryProperties = {
    projectId: string;
    teamId: string;
};

export function ConnectProjectRepository({
    projectId,
    teamId,
}: ConnectProjectRepositoryProperties) {
    const { t } = useTranslation("board");
    const { githubAccessToken, user } = useAuth();
    const [search, setSearch] = useState("");
    const connect = useConnectProjectGithub(projectId);
    const { data: teamProjects = [] } = useProjectsByTeam(teamId);
    const {
        data: repos = [],
        error,
        isLoading,
    } = useGitHubRepos(githubAccessToken, user?.id);

    const connectedRepoIds = useMemo(
        () =>
            new Set(
                teamProjects
                    .map((project) => project.github_repo_id)
                    .filter((id): id is number => id != undefined)
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

    const handleConnect = async (repo: GitHubRepo) => {
        try {
            await connect.mutateAsync(repo);
            toast.success(t("settings.repository.connectSuccess"));
        } catch (connectError) {
            toast.error(
                isUniqueViolation(connectError)
                    ? t("settings.repository.connectDuplicate")
                    : t("settings.repository.connectFailed")
            );
        }
    };

    const missingRepoScope = error instanceof GitHubMissingRepoScopeError;
    const hasGitHubToken = Boolean(githubAccessToken);

    if (!hasGitHubToken) {
        return (
            <div className="mt-2 flex flex-col gap-3">
                <p className="text-ui text-muted-foreground">
                    {t("settings.repository.connect")}
                </p>
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
        <div className="mt-2 flex flex-col gap-3">
            <p className="text-ui text-muted-foreground">
                {t("settings.repository.connect")}
            </p>
            <Input
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("settings.repository.searchRepos")}
                type="search"
                value={search}
            />

            <ScrollArea className="h-72 rounded-lg border border-border">
                <div className="p-1 pr-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
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
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                            {t("settings.repository.noReposFound")}
                        </p>
                    ) : undefined}

                    <ul className="flex flex-col gap-1">
                        {availableRepos.map((repo) => (
                            <li key={repo.id}>
                                <Button
                                    className="h-auto w-full justify-between px-3 py-2.5 text-left"
                                    disabled={connect.isPending}
                                    onClick={() => {
                                        void handleConnect(repo);
                                    }}
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
                                        <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                                            {repo.full_name}
                                        </p>
                                        {repo.description ? (
                                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
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
        </div>
    );
}
