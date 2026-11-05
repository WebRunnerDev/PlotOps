import { Lock } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { GitHubRepo, Project } from "@/features/projects/model/types";

import { signInWithGitHub } from "@/features/auth";
import { GitHubMissingRepoScopeError } from "@/features/projects/api/github-api";
import { isUniqueViolation } from "@/features/projects/lib/is-unique-violation";
import {
    defaultProjectNameFromRepos,
    isValidProjectName,
    isValidProjectSlug,
    suggestProjectSlug,
} from "@/features/projects/model/build-create-project-input";
import {
    canAddRepositoryToProject,
    PROJECT_REPOSITORIES_CAP,
    TEAM_PROJECTS_CAP,
} from "@/features/projects/model/limits";
import { useGitHubRepos } from "@/features/projects/model/use-github-repos";
import { useCreateProject } from "@/features/projects/model/use-projects";
import { SuggestCollaboratorsStep } from "@/features/projects/ui/suggest-collaborators-step";
import { isCapExceeded } from "@/shared/lib/is-cap-exceeded";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
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

type RepoOptionProperties = {
    checked: boolean;
    disabled: boolean;
    /** Name of the Team's Project already linking this repo, if any. */
    linkedProjectName: string | undefined;
    onToggle: (checked: boolean) => void;
    repo: GitHubRepo;
    /** The Repository cap is reached: unchecked repos cannot be added. */
    selectionFull: boolean;
};

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
    const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);
    const [repoProjectName, setRepoProjectName] = useState("");
    const [repoProjectNameTouched, setRepoProjectNameTouched] = useState(false);
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
            setSelectedRepos([]);
            setRepoProjectName("");
            setRepoProjectNameTouched(false);
        }
    }, [open]);

    /** github_repo_id → name of the Team's Project that already links it. */
    const linkedProjectByRepoId = useMemo(() => {
        const linked = new Map<number, string>();
        for (const project of connectedProjects) {
            for (const repo of project.repositories) {
                linked.set(repo.github_repo_id, project.name);
            }
        }
        return linked;
    }, [connectedProjects]);

    const visibleRepos = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return repos;

        return repos.filter(
            (repo) =>
                repo.full_name.toLowerCase().includes(query) ||
                repo.description?.toLowerCase().includes(query)
        );
    }, [repos, search]);

    const selectedRepoIds = useMemo(
        () => new Set(selectedRepos.map((repo) => repo.id)),
        [selectedRepos]
    );
    const repoCapReached = !canAddRepositoryToProject(selectedRepos.length);

    const toggleRepo = (repo: GitHubRepo, checked: boolean) => {
        const next = checked
            ? selectedRepoIds.has(repo.id) ||
              !canAddRepositoryToProject(selectedRepos.length)
                ? selectedRepos
                : [...selectedRepos, repo]
            : selectedRepos.filter((selected) => selected.id !== repo.id);
        setSelectedRepos(next);
        if (!repoProjectNameTouched) {
            setRepoProjectName(defaultProjectNameFromRepos(next));
        }
    };

    const canSubmitRepos =
        selectedRepos.length > 0 &&
        isValidProjectName(repoProjectName) &&
        !createProject.isPending;

    const canSubmitNameOnly =
        isValidProjectName(name) &&
        isValidProjectSlug(slug) &&
        !createProject.isPending;

    const handleReposSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!canSubmitRepos) return;
        const [first] = selectedRepos;

        try {
            await createProject.mutateAsync({
                mode: "github",
                name: repoProjectName,
                repos: selectedRepos,
                teamId,
            });
            if (accessToken && first) {
                setStep({
                    kind: "suggest-collaborators",
                    owner: first.owner.login,
                    repo: first.name,
                });
                return;
            }
            onOpenChange(false);
        } catch (connectError) {
            toast.error(
                isCapExceeded(connectError, "team_projects_cap")
                    ? t("addProjectCapReached", { cap: TEAM_PROJECTS_CAP })
                    : isCapExceeded(connectError, "project_repositories_cap")
                      ? t("createProjectRepoCapReached", {
                            cap: PROJECT_REPOSITORIES_CAP,
                        })
                      : isUniqueViolation(connectError)
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
                isCapExceeded(createError, "team_projects_cap")
                    ? t("addProjectCapReached", { cap: TEAM_PROJECTS_CAP })
                    : isUniqueViolation(createError)
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
                    mode === "github" && !suggesting
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
                                    <form
                                        className="flex min-h-0 flex-1 flex-col overflow-hidden"
                                        onSubmit={(event) =>
                                            void handleReposSubmit(event)
                                        }
                                    >
                                        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3">
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
                                            <p
                                                aria-live="polite"
                                                className="text-meta text-muted-foreground"
                                            >
                                                {repoCapReached
                                                    ? t(
                                                          "createProjectReposCapHint",
                                                          {
                                                              cap: PROJECT_REPOSITORIES_CAP,
                                                          }
                                                      )
                                                    : t(
                                                          "createProjectReposSelected",
                                                          {
                                                              cap: PROJECT_REPOSITORIES_CAP,
                                                              count: selectedRepos.length,
                                                          }
                                                      )}
                                            </p>
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
                                                    visibleRepos.length ===
                                                        0 && (
                                                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                                            {t("noReposFound")}
                                                        </p>
                                                    )}

                                                <ul className="flex flex-col gap-1">
                                                    {visibleRepos.map(
                                                        (repo) => (
                                                            <RepoOption
                                                                checked={selectedRepoIds.has(
                                                                    repo.id
                                                                )}
                                                                disabled={
                                                                    createProject.isPending
                                                                }
                                                                key={repo.id}
                                                                linkedProjectName={linkedProjectByRepoId.get(
                                                                    repo.id
                                                                )}
                                                                onToggle={(
                                                                    checked
                                                                ) => {
                                                                    toggleRepo(
                                                                        repo,
                                                                        checked
                                                                    );
                                                                }}
                                                                repo={repo}
                                                                selectionFull={
                                                                    repoCapReached
                                                                }
                                                            />
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        </ScrollArea>

                                        <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-3">
                                            <div className="flex flex-col gap-2">
                                                <Label htmlFor="repo-project-name">
                                                    {t("projectNameLabel")}
                                                </Label>
                                                <Input
                                                    disabled={
                                                        createProject.isPending ||
                                                        selectedRepos.length ===
                                                            0
                                                    }
                                                    id="repo-project-name"
                                                    onChange={(event) => {
                                                        setRepoProjectNameTouched(
                                                            true
                                                        );
                                                        setRepoProjectName(
                                                            event.target.value
                                                        );
                                                    }}
                                                    placeholder={t(
                                                        "createProjectReposNamePlaceholder"
                                                    )}
                                                    value={repoProjectName}
                                                />
                                            </div>
                                            <DialogFooter className="px-0 sm:justify-end">
                                                <Button
                                                    disabled={
                                                        createProject.isPending
                                                    }
                                                    onClick={() =>
                                                        onOpenChange(false)
                                                    }
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {t("createProjectCancel")}
                                                </Button>
                                                <Button
                                                    disabled={!canSubmitRepos}
                                                    type="submit"
                                                >
                                                    {createProject.isPending ? (
                                                        <Spinner data-icon="inline-start" />
                                                    ) : null}
                                                    {t(
                                                        "createProjectReposConfirm",
                                                        {
                                                            count: selectedRepos.length,
                                                        }
                                                    )}
                                                </Button>
                                            </DialogFooter>
                                        </div>
                                    </form>
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

function RepoOption({
    checked,
    disabled,
    linkedProjectName,
    onToggle,
    repo,
    selectionFull,
}: RepoOptionProperties) {
    const { t } = useTranslation("home");
    const isLinked = linkedProjectName !== undefined;
    const isDisabled = disabled || isLinked || (selectionFull && !checked);
    const inputId = `create-project-repo-${repo.id}`;

    return (
        <li>
            <label
                className={
                    isDisabled
                        ? "flex cursor-not-allowed items-start gap-3 px-3 py-2.5 opacity-60"
                        : "flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/60"
                }
                htmlFor={inputId}
            >
                <Checkbox
                    checked={checked}
                    className="mt-1"
                    disabled={isDisabled}
                    id={inputId}
                    onCheckedChange={(next) => {
                        onToggle(next === true);
                    }}
                />
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
                    {isLinked ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("createProjectRepoAlreadyLinked", {
                                project: linkedProjectName,
                            })}
                        </p>
                    ) : repo.description ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {repo.description}
                        </p>
                    ) : null}
                </div>
            </label>
        </li>
    );
}
