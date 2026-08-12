import { Lock, Plus } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { GitHubRepo, Project } from "@/features/projects/model/types";

import { signInWithGitHub } from "@/features/auth";
import { GitHubMissingRepoScopeError } from "@/features/projects/api/github-api";
import { isUniqueViolation } from "@/features/projects/lib/is-unique-violation";
import {
    isValidProjectName,
    isValidProjectSlug,
    suggestProjectSlug,
} from "@/features/projects/model/build-create-project-input";
import { useGitHubRepos } from "@/features/projects/model/use-github-repos";
import { useCreateProject } from "@/features/projects/model/use-projects";
import { SuggestCollaboratorsStep } from "@/features/projects/ui/suggest-collaborators-step";
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

type AddProjectDialogProperties = {
    accessToken: null | string;
    connectedProjects: Project[];
    onOpenChange: (open: boolean) => void;
    open: boolean;
    teamId: string;
    userId: string;
};

type CreateProjectMode = "github" | "name-only";

type DialogStep =
    | { kind: "create" }
    | { kind: "suggest-collaborators"; owner: string; repo: string };

export function AddProjectDialog({
    accessToken,
    connectedProjects,
    onOpenChange,
    open,
    teamId,
    userId,
}: AddProjectDialogProperties) {
    const { t } = useTranslation("home");
    const [mode, setMode] = useState<CreateProjectMode>("github");
    const [step, setStep] = useState<DialogStep>({ kind: "create" });
    const [search, setSearch] = useState("");
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const createProject = useCreateProject();
    const {
        data: repos = [],
        error,
        isLoading,
    } = useGitHubRepos(accessToken, userId);

    useEffect(() => {
        if (!open) {
            setMode("github");
            setStep({ kind: "create" });
            setSearch("");
            setName("");
            setSlug("");
            setSlugTouched(false);
        }
    }, [open]);

    const connectedRepoIds = useMemo(
        () =>
            new Set(
                connectedProjects
                    .map((project) => project.github_repo_id)
                    .filter((id): id is number => id != undefined)
            ),
        [connectedProjects]
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

    const canSubmitNameOnly =
        isValidProjectName(name) &&
        isValidProjectSlug(slug) &&
        !createProject.isPending;

    const handleConnect = async (repo: GitHubRepo) => {
        try {
            await createProject.mutateAsync({
                mode: "github",
                repo,
                teamId,
            });
            if (accessToken) {
                setStep({
                    kind: "suggest-collaborators",
                    owner: repo.owner.login,
                    repo: repo.name,
                });
                return;
            }
            onOpenChange(false);
        } catch (connectError) {
            toast.error(
                isUniqueViolation(connectError)
                    ? t("createProjectDuplicate")
                    : t("createProjectFailed")
            );
        }
    };

    const handleNameOnlySubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmitNameOnly) return;

        try {
            await createProject.mutateAsync({
                mode: "name-only",
                name,
                slug,
                teamId,
            });
            onOpenChange(false);
        } catch (createError) {
            toast.error(
                isUniqueViolation(createError)
                    ? t("createProjectSlugDuplicate")
                    : t("createNameOnlyProjectFailed")
            );
        }
    };

    const missingRepoScope = error instanceof GitHubMissingRepoScopeError;
    const hasGitHubToken = Boolean(accessToken);
    const suggesting =
        step.kind === "suggest-collaborators" && Boolean(accessToken);

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next && createProject.isPending) return;
                onOpenChange(next);
            }}
            open={open}
        >
            <DialogContent
                className={
                    suggesting || mode === "github"
                        ? "flex h-[min(80vh,640px)] max-h-[min(80vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
                        : "flex max-h-[min(80vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
                }
            >
                <DialogHeader className="border-b border-border px-4 py-3">
                    <DialogTitle>
                        {suggesting
                            ? t("collaboratorSuggestTitle")
                            : t("addProjectTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {suggesting
                            ? t("collaboratorSuggestSubtitle", {
                                  repo: `${step.owner}/${step.repo}`,
                              })
                            : t("addProjectSubtitle")}
                    </DialogDescription>
                </DialogHeader>

                {suggesting && accessToken ? (
                    <SuggestCollaboratorsStep
                        accessToken={accessToken}
                        onDone={() => onOpenChange(false)}
                        owner={step.owner}
                        repo={step.repo}
                        teamId={teamId}
                    />
                ) : (
                    <>
                        <div
                            aria-label={t("createProjectModeLabel")}
                            className="flex flex-wrap gap-2 border-b border-border px-4 py-3"
                            role="group"
                        >
                            {(
                                [
                                    ["github", t("createProjectModeGitHub")],
                                    [
                                        "name-only",
                                        t("createProjectModeNameOnly"),
                                    ],
                                ] as const
                            ).map(([value, label]) => (
                                <Button
                                    aria-pressed={mode === value}
                                    disabled={createProject.isPending}
                                    key={value}
                                    onClick={() => {
                                        setMode(value);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant={
                                        mode === value ? "default" : "outline"
                                    }
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>

                        {mode === "github" ? (
                            <>
                                {hasGitHubToken ? (
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                        <div className="shrink-0 border-b border-border px-4 py-3">
                                            <Input
                                                onChange={(event) =>
                                                    setSearch(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder={t("searchRepos")}
                                                type="search"
                                                value={search}
                                            />
                                        </div>

                                        <ScrollArea className="min-h-0 flex-1">
                                            <div className="p-2 pr-3">
                                                {isLoading && (
                                                    <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                                                        <Spinner />
                                                        {t("loadingRepos")}
                                                    </div>
                                                )}

                                                {error && (
                                                    <Alert
                                                        className="mx-2"
                                                        variant="destructive"
                                                    >
                                                        <AlertDescription className="flex flex-col gap-3">
                                                            <span>
                                                                {missingRepoScope
                                                                    ? t(
                                                                          "reposScopeError"
                                                                      )
                                                                    : t(
                                                                          "reposError"
                                                                      )}
                                                            </span>
                                                            {missingRepoScope && (
                                                                <Button
                                                                    className="self-start"
                                                                    onClick={
                                                                        handleReconnectGitHub
                                                                    }
                                                                    size="sm"
                                                                    type="button"
                                                                    variant="outline"
                                                                >
                                                                    {t(
                                                                        "reconnectGitHub"
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </AlertDescription>
                                                    </Alert>
                                                )}

                                                {!isLoading &&
                                                    !error &&
                                                    availableRepos.length ===
                                                        0 && (
                                                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                                            {t("noReposFound")}
                                                        </p>
                                                    )}

                                                <ul className="flex flex-col gap-1">
                                                    {availableRepos.map(
                                                        (repo) => (
                                                            <li key={repo.id}>
                                                                <Button
                                                                    className="h-auto w-full justify-between px-3 py-2.5 text-left"
                                                                    disabled={
                                                                        createProject.isPending
                                                                    }
                                                                    onClick={() => {
                                                                        void handleConnect(
                                                                            repo
                                                                        );
                                                                    }}
                                                                    type="button"
                                                                    variant="ghost"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="truncate font-medium">
                                                                                {
                                                                                    repo.name
                                                                                }
                                                                            </span>
                                                                            {repo.private && (
                                                                                <Lock
                                                                                    aria-hidden
                                                                                    className="size-3 shrink-0 text-muted-foreground"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <p className="font-mono text-xs text-muted-foreground">
                                                                            {
                                                                                repo.full_name
                                                                            }
                                                                        </p>
                                                                        {repo.description && (
                                                                            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                                                                {
                                                                                    repo.description
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <Plus className="shrink-0 text-primary" />
                                                                </Button>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                ) : (
                                    <div className="flex flex-1 flex-col gap-3 p-4">
                                        <Alert>
                                            <AlertDescription>
                                                {t("githubRequired")}
                                            </AlertDescription>
                                        </Alert>
                                        <Button
                                            className="self-start"
                                            onClick={handleReconnectGitHub}
                                            type="button"
                                            variant="outline"
                                        >
                                            {t("reconnectGitHub")}
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <form
                                className="flex flex-col gap-4 p-4"
                                onSubmit={(event) =>
                                    void handleNameOnlySubmit(event)
                                }
                            >
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="project-name">
                                        {t("projectNameLabel")}
                                    </Label>
                                    <Input
                                        autoFocus
                                        disabled={createProject.isPending}
                                        id="project-name"
                                        onChange={(event) => {
                                            const nextName = event.target.value;
                                            setName(nextName);
                                            if (!slugTouched) {
                                                setSlug(
                                                    suggestProjectSlug(nextName)
                                                );
                                            }
                                        }}
                                        placeholder={t(
                                            "projectNamePlaceholder"
                                        )}
                                        value={name}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="project-slug">
                                        {t("projectSlugLabel")}
                                    </Label>
                                    <Input
                                        className="font-mono"
                                        disabled={createProject.isPending}
                                        id="project-slug"
                                        onChange={(event) => {
                                            setSlugTouched(true);
                                            setSlug(event.target.value);
                                        }}
                                        placeholder={t(
                                            "projectSlugPlaceholder"
                                        )}
                                        spellCheck={false}
                                        value={slug}
                                    />
                                    <p className="text-meta text-muted-foreground">
                                        {t("projectSlugHint")}
                                    </p>
                                </div>
                                <DialogFooter className="px-0 sm:justify-end">
                                    <Button
                                        disabled={createProject.isPending}
                                        onClick={() => onOpenChange(false)}
                                        type="button"
                                        variant="outline"
                                    >
                                        {t("createProjectCancel")}
                                    </Button>
                                    <Button
                                        disabled={!canSubmitNameOnly}
                                        type="submit"
                                    >
                                        {createProject.isPending ? (
                                            <Spinner data-icon="inline-start" />
                                        ) : null}
                                        {t("createNameOnlyProjectConfirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

async function handleReconnectGitHub() {
    await signInWithGitHub();
}
