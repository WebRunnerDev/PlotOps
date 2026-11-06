import { Link } from "@tanstack/react-router";
import {
    Check,
    Copy,
    ExternalLink,
    GitBranch,
    GitCommit,
    GitPullRequest,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Sparkles,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    GitLinkAttachKind,
    GitLinkChange,
    GitLinkRepository,
    GitLinkTarget,
} from "@/features/tasks/lib/task-git-links";
import type {
    Task,
    TaskGitLink,
    TaskPullRequest,
} from "@/features/tasks/model/types";

import { useAuth } from "@/features/auth";
import { matchesAllowedHeadPatterns } from "@/features/boards";
import {
    approvePrErrorKind,
    fetchCommitBySha,
    fetchPullRequest,
    gitHubWriteErrorKind,
    type GitMergeMethod,
    isGitHubApiError,
    requestReviewErrorKind,
} from "@/features/git-integration/api/github-git-api";
import { canFetchPullRequestFiles } from "@/features/git-integration/lib/can-fetch-git-data";
import { canReviewGithubPr } from "@/features/git-integration/lib/can-review-github-pr";
import { canWriteGithubPr } from "@/features/git-integration/lib/can-write-github-pr";
import { defaultPullRequestTitle } from "@/features/git-integration/lib/default-pull-request-title";
import {
    useApprovePullRequest,
    useClosePullRequest,
    useCreatePullRequest,
    useMergePullRequest,
    useReopenPullRequest,
    useRequestPullRequestReviewers,
} from "@/features/git-integration/model/use-github-pr-writes";
import { PrChecksSummary } from "@/features/git-integration/ui/pr-checks-summary";
import { PrDiffDialog } from "@/features/git-integration/ui/pr-diff-dialog";
import { RequestReviewDialog } from "@/features/git-integration/ui/request-review-dialog";
import { isGuest } from "@/features/guest-mode";
import {
    githubPanelNeedsRepo,
    resolveProjectConnectHash,
} from "@/features/projects/model/project-github-gate";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    generateBranchName,
    isSharedBranch,
    normalizeBranchName,
} from "@/features/tasks/lib/format-branch";
import { parseCommitSha } from "@/features/tasks/lib/parse-commit-sha";
import { parsePrNumber } from "@/features/tasks/lib/parse-pr";
import {
    findGitLink,
    gitLinkRestoreChange,
    gitTabRepositories,
    linkedGitLinks,
    newGitLinkId,
    pickDefaultRepositoryId,
    planAttachPr,
} from "@/features/tasks/lib/task-git-links";
import { useGitLinkRepositoryStore } from "@/features/tasks/model/git-link-repository-store";
import { useBackfillGitLinks } from "@/features/tasks/model/use-backfill-git-links";
import { TaskGithubCommits } from "@/features/tasks/ui/task-github-commits";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";
import { Input } from "@/shared/shadcn/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";

const PR_STATE_CLASS: Record<NonNullable<Task["pr"]>["state"], string> = {
    closed: "text-red-500",
    merged: "text-purple-500",
    open: "text-emerald-500",
};

const MERGE_METHODS: GitMergeMethod[] = ["squash", "merge", "rebase"];

/** What the "+ Link" menu opened: a branch, a PR or a commit form. */
type AttachKind = "commit" | GitLinkAttachKind;

type GitLinkRowProperties = {
    /** Base branch of this Repository on the Board; null unless Development Board. */
    baseBranch: null | string;
    canEdit: boolean;
    githubToken: null | string;
    /**
     * Accessible name of the row: the Repository, plus the branch / PR when
     * the Repository holds several Git links of the Task (ADR 0036).
     */
    label: string;
    link: TaskGitLink;
    onChange: (change: GitLinkChange) => void;
    /** Unlink with an "Unlinked · Undo" toast. */
    onUnlink: (change: GitLinkChange) => void;
    projectId: string;
    repository: GitLinkRepository;
    task: Task;
};

type PendingBranch = { branchName: string; repositoryId: string };

type TaskGithubPanelProperties = {
    /** Board-level Allowed head patterns — shared by every Repository. */
    allowedHeadPatterns: string[];
    /** Base branch per Repository id; null for a Repository / non-Development Board. */
    baseBranchFor: (repositoryId: string) => null | string;
    boardId: string;
    /** Drawer edit gate (`canEditTasks && !archived`) — same Role seam as Board. */
    canEdit: boolean;
    githubToken: null | string;
    /** Write one Git link; a new `linkId` adds one (ADR 0036). */
    onGitLinkChange: (target: GitLinkTarget, change: GitLinkChange) => void;
    onLinkedCommitChange: (linkedCommitSha: null | string) => void;
    /** Project id for connect deep-link when no Repository is linked. */
    projectId: string;
    /** The Project's Repositories, in Project order. */
    repositories: GitLinkRepository[];
    task: Task;
};

/**
 * Drawer GitHub block (ADR 0035, 0036): one row per Git link — a Repository
 * may hold several — with branch, then PR status or Open PR (from that row's
 * branch), then a `⋯` menu; the Task's Commits; and a single "+ Link" menu
 * that adds a branch, PR or commit.
 */
export function TaskGithubPanel({
    allowedHeadPatterns,
    baseBranchFor,
    boardId,
    canEdit,
    githubToken,
    onGitLinkChange,
    onLinkedCommitChange,
    projectId,
    repositories,
    task,
}: TaskGithubPanelProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const lastRepositoryId = useGitLinkRepositoryStore((state) =>
        state.lastRepositoryId(user?.id, boardId)
    );
    const setLastRepositoryId = useGitLinkRepositoryStore(
        (state) => state.setLastRepositoryId
    );

    const [attach, setAttach] = useState<AttachKind | null>(null);
    const [chosenRepositoryId, setChosenRepositoryId] = useState<
        string | undefined
    >();
    const [draft, setDraft] = useState("");
    const [attachLoading, setAttachLoading] = useState(false);
    const [pendingBranch, setPendingBranch] = useState<null | PendingBranch>(
        null
    );
    const lookupAbort = useRef<AbortController | undefined>(undefined);
    const lookupGeneration = useRef(0);
    const backfill = useBackfillGitLinks(projectId);

    const closeAttach = () => {
        lookupAbort.current?.abort();
        lookupAbort.current = undefined;
        lookupGeneration.current += 1;
        setAttach(null);
        setChosenRepositoryId(undefined);
        setDraft("");
        setAttachLoading(false);
    };

    useEffect(() => {
        lookupAbort.current?.abort();
        lookupAbort.current = undefined;
        lookupGeneration.current += 1;
        setAttach(null);
        setChosenRepositoryId(undefined);
        setDraft("");
        setAttachLoading(false);
        setPendingBranch(null);
    }, [task.id]);

    if (githubPanelNeedsRepo(repositories)) {
        return (
            <div className="flex flex-col gap-3 rounded-none bg-muted/40 p-3 ring-1 ring-primary/20">
                <div className="flex flex-col gap-0.5">
                    <p className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                        {t("github.title")}
                    </p>
                    <p className="text-ui text-muted-foreground">
                        {t("github.connectRepo")}
                    </p>
                </div>
                {task.branchName ? (
                    <p className="min-w-0 truncate font-mono text-code text-muted-foreground">
                        {task.branchName}
                    </p>
                ) : undefined}
                {task.pr ? (
                    <p className="min-w-0 truncate text-ui text-muted-foreground">
                        {t("github.prLink", {
                            number: task.pr.number,
                            state: t(`prState.${task.pr.state}`),
                        })}
                    </p>
                ) : undefined}
                <Button
                    className="self-start"
                    nativeButton={false}
                    render={
                        <Link
                            hash={resolveProjectConnectHash()}
                            params={{ projectId }}
                            to="/projects/$projectId/settings"
                        />
                    }
                    size="xs"
                    variant="outline"
                >
                    {t("github.connectRepoAction")}
                </Button>
            </div>
        );
    }

    const multiRepository = repositories.length > 1;
    const linked = linkedGitLinks(repositories, task.gitLinks);
    const canFetchGithub = Boolean(githubToken);
    // Any Repository takes another branch / PR (ADR 0036); commits search all.
    const attachOptions = repositories;
    const attachRepositoryId = pickDefaultRepositoryId(
        attachOptions,
        chosenRepositoryId ?? lastRepositoryId
    );
    const attachRepository = attachOptions.find(
        (repository) => repository.id === attachRepositoryId
    );

    const changeGitLink = (target: GitLinkTarget, change: GitLinkChange) => {
        if (!task.gitLinks?.some((link) => link.id === target.linkId)) {
            setLastRepositoryId(user?.id, boardId, target.repositoryId);
        }
        onGitLinkChange(target, change);
    };

    /** Unlink right away; the toast's Undo puts the previous Git link back. */
    const unlinkGitLink = (target: GitLinkTarget, change: GitLinkChange) => {
        if (!canEdit) return;
        const previous = task.gitLinks?.find(
            (link) => link.id === target.linkId
        );
        onGitLinkChange(target, change);
        toast(t("github.unlinkedToast"), {
            action: {
                label: t("github.undo"),
                onClick: () => {
                    onGitLinkChange(target, gitLinkRestoreChange(previous));
                },
            },
        });
    };

    /** A branch is a new Git link unless this Repository already holds it. */
    const linkBranch = (repositoryId: string, branchName: string) => {
        if (findGitLink(task.gitLinks, repositoryId, { branchName })) {
            toast.message(
                t("github.branchAlreadyLinked", { branch: branchName })
            );
            return;
        }
        changeGitLink({ linkId: newGitLinkId(), repositoryId }, { branchName });
        if (isSharedBranch(branchName)) {
            toast.message(
                t("github.sharedLinkedToast", { branch: branchName })
            );
        }
    };

    /** Allowed head patterns apply to every Repository (they live on the Board). */
    const requestBranch = (repositoryId: string, branchName: string) => {
        if (!canEdit) return;
        if (!matchesAllowedHeadPatterns(branchName, allowedHeadPatterns)) {
            setPendingBranch({ branchName, repositoryId });
            return;
        }
        linkBranch(repositoryId, branchName);
    };

    const openAttach = (kind: AttachKind) => {
        closeAttach();
        setAttach(kind);
    };

    const handleLinkBranchConfirm = () => {
        if (!canEdit || !attachRepository) return;
        const next = normalizeBranchName(draft);
        if (!next) {
            toast.error(t("github.branchRequired"));
            return;
        }
        const repositoryId = attachRepository.id;
        closeAttach();
        requestBranch(repositoryId, next);
    };

    const handleLinkPrConfirm = async () => {
        if (!canEdit || !attachRepository) return;
        const number = parsePrNumber(draft);
        if (number == undefined) {
            toast.error(t("github.prRequired"));
            return;
        }
        if (!githubToken) {
            toast.error(t("github.prNeedsGithub"));
            return;
        }

        lookupAbort.current?.abort();
        const controller = new AbortController();
        lookupAbort.current = controller;
        const generation = ++lookupGeneration.current;
        const repository = attachRepository;

        setAttachLoading(true);
        try {
            const remote = await fetchPullRequest(
                repository.fullName,
                number,
                githubToken,
                controller.signal
            );
            if (generation !== lookupGeneration.current) return;

            const nextPr: TaskPullRequest = {
                number: remote.number,
                state: remote.merged_at ? "merged" : remote.state,
                url: remote.url,
            };
            const plan = planAttachPr(task.gitLinks, repository.id, {
                headRef: remote.head_ref,
                number: nextPr.number,
            });
            if (plan.kind === "duplicate") {
                closeAttach();
                toast.message(
                    t("github.prAlreadyLinked", { number: nextPr.number })
                );
                return;
            }
            // The PR joins the branch-only Git link on its head, else adds one.
            changeGitLink(
                {
                    linkId:
                        plan.kind === "join" ? plan.link.id : newGitLinkId(),
                    repositoryId: repository.id,
                },
                { pr: nextPr }
            );
            closeAttach();
            toast.success(t("github.prLinkedToast", { number: nextPr.number }));
        } catch (error) {
            if (generation !== lookupGeneration.current) return;
            if (controller.signal.aborted) return;

            if (isGitHubApiError(error)) {
                switch (error.status) {
                    case 401:
                    case 403: {
                        toast.error(t("github.prAuthFailed"));

                        break;
                    }
                    case 404: {
                        toast.error(t("github.prNotFound", { number }));

                        break;
                    }
                    case 429: {
                        toast.error(t("github.prRateLimited"));

                        break;
                    }
                    default: {
                        toast.error(t("github.prLinkFailed", { number }));
                    }
                }
            } else {
                toast.error(t("github.prLinkFailed", { number }));
            }
        } finally {
            if (generation === lookupGeneration.current) {
                setAttachLoading(false);
            }
        }
    };

    const handleLinkCommitConfirm = async () => {
        if (!canEdit) return;
        const sha = parseCommitSha(draft);
        if (!sha) {
            toast.error(t("github.commitRequired"));
            return;
        }
        if (!githubToken || repositories.length === 0) {
            toast.error(t("github.commitNeedsGithub"));
            return;
        }

        lookupAbort.current?.abort();
        const controller = new AbortController();
        lookupAbort.current = controller;
        const generation = ++lookupGeneration.current;

        setAttachLoading(true);
        try {
            const remote = await findCommitInRepositories(
                repositories,
                sha,
                githubToken,
                controller.signal
            );
            if (generation !== lookupGeneration.current) return;

            onLinkedCommitChange(remote.sha);
            closeAttach();
            toast.success(
                t("github.commitLinkedToast", {
                    sha: remote.sha.slice(0, 7),
                })
            );
        } catch (error) {
            if (generation !== lookupGeneration.current) return;
            if (controller.signal.aborted) return;

            if (isGitHubApiError(error)) {
                switch (error.status) {
                    case 401:
                    case 403: {
                        toast.error(t("github.commitAuthFailed"));

                        break;
                    }
                    case 404: {
                        toast.error(t("github.commitNotFound", { sha }));

                        break;
                    }
                    case 429: {
                        toast.error(t("github.commitRateLimited"));

                        break;
                    }
                    default: {
                        toast.error(t("github.commitLinkFailed", { sha }));
                    }
                }
            } else {
                toast.error(t("github.commitLinkFailed", { sha }));
            }
        } finally {
            if (generation === lookupGeneration.current) {
                setAttachLoading(false);
            }
        }
    };

    const handleUnlinkCommit = () => {
        if (!canEdit) return;
        const previous = task.linkedCommitSha;
        onLinkedCommitChange(null);
        if (!previous) return;
        toast(t("github.unlinkedToast"), {
            action: {
                label: t("github.undo"),
                onClick: () => onLinkedCommitChange(previous),
            },
        });
    };

    const handleAttachConfirm = () => {
        switch (attach) {
            case "branch": {
                handleLinkBranchConfirm();
                break;
            }
            case "commit": {
                void handleLinkCommitConfirm();
                break;
            }
            case null: {
                break;
            }
            case "pr": {
                void handleLinkPrConfirm();
                break;
            }
        }
    };

    const attachHint =
        attach === "branch"
            ? t("github.linkBranchHint")
            : attach === "pr"
              ? t("github.linkPrHint")
              : t("github.linkCommitHint");
    const attachPlaceholder =
        attach === "branch"
            ? t("github.linkBranchPlaceholder")
            : attach === "pr"
              ? t("github.linkPrPlaceholder")
              : t("github.linkCommitPlaceholder");
    const attachConfirmLabel =
        attach === "branch"
            ? t("github.linkConfirm")
            : attach === "pr"
              ? t("github.linkPrConfirm")
              : t("github.linkCommitConfirm");

    /** Find open PRs and branches with a task key on GitHub (auto-link). */
    const refreshGitLinks = () => {
        if (!canEdit || backfill.isPending) return;
        backfill.mutate(undefined, {
            onError: () => {
                toast.error(t("github.refreshLinksFailed"));
            },
            onSuccess: (result) => {
                if (!result.configured) {
                    toast.error(t("github.refreshLinksFailed"));
                } else if (result.linked > 0) {
                    toast.success(
                        t("github.refreshLinksLinked", { count: result.linked })
                    );
                } else if (result.unavailable > 0) {
                    toast.warning(t("github.refreshLinksUnavailable"));
                } else {
                    toast.message(t("github.refreshLinksNone"));
                }
            },
        });
    };
    const canRefreshLinks = canEdit && !isGuest();

    // Several Git links in one Repository: commits follow the newest own branch.
    const commitRepositories = gitTabRepositories(
        repositories,
        task.gitLinks
    ).map(({ links, repository }) => ({
        branchName: links
            .flatMap((link) =>
                link.branchName && !isSharedBranch(link.branchName)
                    ? [link.branchName]
                    : []
            )
            .at(-1),
        fullName: repository.fullName,
        id: repository.id,
    }));

    return (
        <>
            <div
                className="flex min-w-0 flex-col gap-3 rounded-none bg-muted/40 p-3 ring-1 ring-primary/20"
                data-testid="task-github-panel"
            >
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                        {t("github.title")}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                        {canRefreshLinks ? (
                            <Button
                                aria-label={t("github.refreshLinks")}
                                disabled={backfill.isPending}
                                onClick={refreshGitLinks}
                                size="icon-xs"
                                title={t("github.refreshLinksHint")}
                                type="button"
                                variant="ghost"
                            >
                                {backfill.isPending ? (
                                    <Spinner className="size-3.5" />
                                ) : (
                                    <RefreshCw
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                )}
                            </Button>
                        ) : undefined}
                        {canEdit ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button
                                            size="xs"
                                            type="button"
                                            variant="outline"
                                        />
                                    }
                                >
                                    <Plus aria-hidden className="size-3.5" />
                                    {t("github.attach")}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-auto min-w-48"
                                >
                                    <DropdownMenuItem
                                        onClick={() => openAttach("branch")}
                                    >
                                        <GitBranch aria-hidden />
                                        {t("github.attachBranch")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={!canFetchGithub}
                                        onClick={() => openAttach("pr")}
                                        title={
                                            canFetchGithub
                                                ? undefined
                                                : t("github.prNeedsGithub")
                                        }
                                    >
                                        <GitPullRequest aria-hidden />
                                        {t("github.attachPr")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={
                                            Boolean(task.linkedCommitSha) ||
                                            !canFetchGithub
                                        }
                                        onClick={() => openAttach("commit")}
                                        title={
                                            canFetchGithub
                                                ? undefined
                                                : t("github.commitNeedsGithub")
                                        }
                                    >
                                        <GitCommit aria-hidden />
                                        {t("github.attachCommit")}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : undefined}
                    </div>
                </div>

                {attach && canEdit ? (
                    <div
                        className="flex min-w-0 flex-col gap-2"
                        data-testid="github-attach-form"
                    >
                        <p className="text-ui text-muted-foreground">
                            {attachHint}
                        </p>
                        {attach !== "commit" && attachOptions.length > 1 ? (
                            <Select
                                onValueChange={(value) => {
                                    if (typeof value !== "string") return;
                                    setChosenRepositoryId(value);
                                    setLastRepositoryId(
                                        user?.id,
                                        boardId,
                                        value
                                    );
                                }}
                                value={attachRepository?.id}
                            >
                                <SelectTrigger
                                    aria-label={t("github.repository")}
                                    className="w-full font-mono text-code"
                                >
                                    <span className="truncate">
                                        {attachRepository?.fullName}
                                    </span>
                                </SelectTrigger>
                                <SelectContent alignItemWithTrigger={false}>
                                    {attachOptions.map((repository) => (
                                        <SelectItem
                                            key={repository.id}
                                            value={repository.id}
                                        >
                                            {repository.fullName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : attach !== "commit" &&
                          multiRepository &&
                          attachRepository ? (
                            <p className="truncate font-mono text-code text-foreground">
                                {attachRepository.fullName}
                            </p>
                        ) : undefined}
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                                aria-label={attachPlaceholder}
                                autoFocus
                                className="min-w-0 font-mono text-code"
                                disabled={attachLoading}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleAttachConfirm();
                                    }
                                    if (
                                        event.key === "Escape" &&
                                        !attachLoading
                                    ) {
                                        event.stopPropagation();
                                        closeAttach();
                                    }
                                }}
                                placeholder={attachPlaceholder}
                                value={draft}
                            />
                            <div className="flex shrink-0 items-center gap-2">
                                {attach === "branch" ? (
                                    <Button
                                        aria-label={t("github.generateBranch")}
                                        onClick={() =>
                                            setDraft(
                                                generateBranchName(
                                                    task.key,
                                                    task.title,
                                                    task.type
                                                )
                                            )
                                        }
                                        size="icon-sm"
                                        title={t("github.generateBranch")}
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Sparkles aria-hidden />
                                    </Button>
                                ) : undefined}
                                <Button
                                    aria-label={attachConfirmLabel}
                                    disabled={attachLoading}
                                    onClick={handleAttachConfirm}
                                    size="icon-sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {attachLoading ? <Spinner /> : <Check />}
                                </Button>
                                <Button
                                    aria-label={t("github.linkCancel")}
                                    disabled={attachLoading}
                                    onClick={closeAttach}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <X />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : undefined}

                {linked.map(({ link, repository }) => (
                    <GitLinkRow
                        baseBranch={baseBranchFor(repository.id)}
                        canEdit={canEdit}
                        githubToken={githubToken}
                        key={link.id}
                        label={gitLinkRowLabel(link, repository, linked)}
                        link={link}
                        onChange={(change) =>
                            changeGitLink(
                                {
                                    linkId: link.id,
                                    repositoryId: repository.id,
                                },
                                change
                            )
                        }
                        onUnlink={(change) =>
                            unlinkGitLink(
                                {
                                    linkId: link.id,
                                    repositoryId: repository.id,
                                },
                                change
                            )
                        }
                        projectId={projectId}
                        repository={repository}
                        task={task}
                    />
                ))}

                <TaskGithubCommits
                    canEdit={canEdit}
                    githubToken={githubToken}
                    linkedCommitSha={task.linkedCommitSha}
                    onUnlinkCommit={handleUnlinkCommit}
                    repositories={commitRepositories}
                    showRepository={multiRepository}
                    taskKey={task.key}
                />
            </div>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open) setPendingBranch(null);
                }}
                open={pendingBranch !== null}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("github.patternMismatchTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.patternMismatchBody", {
                                branch: pendingBranch?.branchName ?? "",
                                patterns: allowedHeadPatterns.join(", "),
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("github.patternMismatchCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (!canEdit || !pendingBranch) return;
                                const next = pendingBranch;
                                setPendingBranch(null);
                                linkBranch(next.repositoryId, next.branchName);
                            }}
                        >
                            {t("github.patternMismatchConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/** Look a commit up in each Repository in turn; a 404 moves on to the next. */
async function findCommitInRepositories(
    repositories: readonly GitLinkRepository[],
    sha: string,
    token: string,
    signal: AbortSignal
) {
    let lastError: unknown;
    for (const repository of repositories) {
        try {
            return await fetchCommitBySha(
                repository.fullName,
                sha,
                token,
                signal
            );
        } catch (error) {
            if (isGitHubApiError(error) && error.status === 404) {
                lastError = error;
                continue;
            }
            throw error;
        }
    }
    throw lastError ?? new Error("Commit not found");
}

/**
 * One Git link (ADR 0035): Repository, branch, then the one main action —
 * PR status with checks, or Open PR — and every other action in `⋯`.
 */
function GitLinkRow({
    baseBranch,
    canEdit,
    githubToken,
    label,
    link,
    onChange,
    onUnlink,
    projectId,
    repository,
    task,
}: GitLinkRowProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const { isSettled, role } = useProjectAccess(projectId);
    const createPr = useCreatePullRequest();
    const mergePr = useMergePullRequest();
    const closePr = useClosePullRequest();
    const reopenPr = useReopenPullRequest();
    const approvePr = useApprovePullRequest();
    const requestReview = useRequestPullRequestReviewers();

    const [copied, setCopied] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [approveOpen, setApproveOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [requestReviewOpen, setRequestReviewOpen] = useState(false);
    const [mergeMethod, setMergeMethod] = useState<GitMergeMethod>("squash");

    const repoFullName = repository.fullName;
    const branchName = link.branchName;
    const pr = link.pr;

    const canWritePr =
        isSettled &&
        canWriteGithubPr({
            isGuest: isGuest(),
            role,
            task,
            userId: user?.id,
        });
    const canReviewPr =
        isSettled &&
        canReviewGithubPr({
            isGuest: isGuest(),
            role,
            task,
            userId: user?.id,
        });

    useEffect(() => {
        setCopied(false);
        setDiffOpen(false);
        setApproveOpen(false);
        setMergeOpen(false);
        setCloseOpen(false);
        setRequestReviewOpen(false);
        setMergeMethod("squash");
    }, [task.id, repository.id, link.id]);

    const checkoutCommand = branchName
        ? `git checkout ${branchName}`
        : undefined;
    const canFetchGithub = Boolean(githubToken && repoFullName);
    const canViewDiff = canFetchPullRequestFiles({
        isGuest: isGuest(),
        prNumber: pr?.number,
        repoFullName,
        token: githubToken,
    });
    const headIsShared = Boolean(branchName && isSharedBranch(branchName));
    const writeActionPending =
        createPr.isPending ||
        mergePr.isPending ||
        closePr.isPending ||
        reopenPr.isPending ||
        approvePr.isPending ||
        requestReview.isPending;
    const canOpenPr =
        canWritePr &&
        canFetchGithub &&
        Boolean(branchName) &&
        Boolean(baseBranch) &&
        !pr &&
        !headIsShared;
    const canMergePr =
        canWritePr &&
        canFetchGithub &&
        pr?.state === "open" &&
        !writeActionPending;
    const canClosePr =
        canWritePr &&
        canFetchGithub &&
        pr?.state === "open" &&
        !writeActionPending;
    // Merged PRs are never reopenable — only `closed` (unmerged) qualifies.
    const canReopenPr =
        canWritePr &&
        canFetchGithub &&
        pr?.state === "closed" &&
        !writeActionPending;
    const canApprovePr =
        canReviewPr &&
        canFetchGithub &&
        pr?.state === "open" &&
        !writeActionPending;
    // Same review gate as Approve; stays true while its own request is in flight
    // so the picker dialog is not torn down mid-submit.
    const canRequestReview =
        canReviewPr && canFetchGithub && pr?.state === "open";

    const toastWriteFailure = (error: unknown, fallbackKey: string) => {
        const kind = gitHubWriteErrorKind(error);
        if (kind === "unknown") {
            toast.error(t(fallbackKey));
            return;
        }
        toast.error(t(`github.writeError.${kind}`));
    };

    const handleCopyCheckout = async () => {
        if (!checkoutCommand) return;

        try {
            await navigator.clipboard.writeText(checkoutCommand);
            setCopied(true);
            toast.success(t("copiedCheckout"));
            globalThis.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t("copyFailed"));
        }
    };

    const handleOpenPr = async () => {
        if (
            !canOpenPr ||
            !githubToken ||
            !repoFullName ||
            !branchName ||
            !baseBranch
        ) {
            return;
        }

        try {
            const remote = await createPr.mutateAsync({
                base: baseBranch,
                head: branchName,
                repoFullName,
                title: defaultPullRequestTitle(task),
                token: githubToken,
            });
            const nextPr: TaskPullRequest = {
                number: remote.number,
                state: remote.merged_at ? "merged" : remote.state,
                url: remote.url,
            };
            onChange({ pr: nextPr });
            toast.success(t("github.openPrToast", { number: nextPr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.openPrFailed");
        }
    };

    const handleMergeConfirm = async () => {
        if (!canMergePr || !githubToken || !repoFullName || !pr) return;

        try {
            await mergePr.mutateAsync({
                commitTitle: defaultPullRequestTitle(task),
                headBranchName: branchName,
                mergeMethod,
                prNumber: pr.number,
                repoFullName,
                token: githubToken,
            });
            onChange({
                pr: { ...pr, state: "merged" },
            });
            setMergeOpen(false);
            toast.success(t("github.mergePrToast", { number: pr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.mergePrFailed");
        }
    };

    const handleCloseConfirm = async () => {
        if (!canClosePr || !githubToken || !repoFullName || !pr) return;

        try {
            await closePr.mutateAsync({
                headBranchName: branchName ?? undefined,
                prNumber: pr.number,
                repoFullName,
                token: githubToken,
            });
            onChange({
                pr: { ...pr, state: "closed" },
            });
            setCloseOpen(false);
            toast.success(t("github.closePrToast", { number: pr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.closePrFailed");
        }
    };

    const handleReopenPr = async () => {
        if (!canReopenPr || !githubToken || !repoFullName || !pr) return;

        try {
            await reopenPr.mutateAsync({
                headBranchName: branchName ?? undefined,
                prNumber: pr.number,
                repoFullName,
                token: githubToken,
            });
            onChange({
                pr: { ...pr, state: "open" },
            });
            toast.success(t("github.reopenPrToast", { number: pr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.reopenPrFailed");
        }
    };

    const handleApprovePr = async () => {
        if (!canApprovePr || !githubToken || !repoFullName || !pr) return;

        try {
            await approvePr.mutateAsync({
                prNumber: pr.number,
                repoFullName,
                token: githubToken,
            });
            setApproveOpen(false);
            toast.success(t("github.approvePrToast", { number: pr.number }));
        } catch (error) {
            if (approvePrErrorKind(error) === "own_pr") {
                setApproveOpen(false);
                toast.error(t("github.approvePrFailed"), {
                    description: t("github.approvePrOwnError"),
                });
                return;
            }
            toastWriteFailure(error, "github.approvePrFailed");
        }
    };

    const handleRequestReview = async (reviewers: string[]) => {
        if (
            !canRequestReview ||
            writeActionPending ||
            !githubToken ||
            !repoFullName ||
            !pr ||
            reviewers.length === 0
        ) {
            return;
        }

        try {
            await requestReview.mutateAsync({
                prNumber: pr.number,
                repoFullName,
                reviewers,
                token: githubToken,
            });
            setRequestReviewOpen(false);
            toast.success(
                t("github.requestReviewToast", {
                    number: pr.number,
                    reviewers: reviewers.join(", "),
                })
            );
        } catch (error) {
            const kind = requestReviewErrorKind(error);
            if (kind === "author" || kind === "invalid_reviewer") {
                toast.error(t(`github.requestReviewError.${kind}`));
                return;
            }
            if (kind === "rate_limit") {
                toast.error(t("github.writeError.rate_limit"));
                return;
            }
            toastWriteFailure(error, "github.requestReviewFailed");
        }
    };

    const handleUnlinkBranch = () => {
        if (!canEdit) return;
        onUnlink({ branchName: null });
    };

    const handleUnlinkPr = () => {
        if (!canEdit) return;
        setDiffOpen(false);
        onUnlink({ pr: null });
    };

    const handleUnlinkGitLink = () => {
        if (!canEdit) return;
        setDiffOpen(false);
        onUnlink({ branchName: null, pr: null });
    };

    const mergeMethodLabel = (method: GitMergeMethod) => {
        switch (method) {
            case "merge": {
                return t("github.mergeMethodMerge");
            }
            case "rebase": {
                return t("github.mergeMethodRebase");
            }
            case "squash": {
                return t("github.mergeMethodSquash");
            }
        }
    };

    const prTitle = pr
        ? t("github.prLink", {
              number: pr.number,
              state: t(`prState.${pr.state}`),
          })
        : "";
    const hasPrActions =
        canViewDiff ||
        canApprovePr ||
        canRequestReview ||
        canMergePr ||
        canClosePr ||
        canReopenPr;
    const hasUnlinkActions = canEdit;
    const hasMenu = Boolean(checkoutCommand) || hasPrActions || canEdit;

    return (
        <>
            <section
                aria-label={label}
                className="flex min-w-0 flex-col gap-1.5 border-t border-primary/15 pt-3"
                data-testid="github-git-link"
            >
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-code font-medium text-foreground">
                        {repoFullName}
                    </p>
                    {hasMenu ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        aria-label={t("github.rowActions", {
                                            repository: label,
                                        })}
                                        className="shrink-0"
                                        size="icon-xs"
                                        type="button"
                                        variant="ghost"
                                    />
                                }
                            >
                                <MoreHorizontal className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-auto min-w-52"
                            >
                                {checkoutCommand ? (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            void handleCopyCheckout();
                                        }}
                                    >
                                        {t("github.copy")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canViewDiff ? (
                                    <DropdownMenuItem
                                        onClick={() => setDiffOpen(true)}
                                    >
                                        {t("git.viewDiff")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canRequestReview ? (
                                    <DropdownMenuItem
                                        disabled={writeActionPending}
                                        onClick={() =>
                                            setRequestReviewOpen(true)
                                        }
                                    >
                                        {t("github.requestReview")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canApprovePr ? (
                                    <DropdownMenuItem
                                        disabled={writeActionPending}
                                        onClick={() => setApproveOpen(true)}
                                    >
                                        {t("github.approvePr")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canMergePr ? (
                                    <DropdownMenuItem
                                        disabled={writeActionPending}
                                        onClick={() => setMergeOpen(true)}
                                    >
                                        {t("github.mergePr")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canClosePr ? (
                                    <DropdownMenuItem
                                        disabled={writeActionPending}
                                        onClick={() => setCloseOpen(true)}
                                    >
                                        {t("github.closePr")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canReopenPr ? (
                                    <DropdownMenuItem
                                        disabled={writeActionPending}
                                        onClick={() => {
                                            void handleReopenPr();
                                        }}
                                    >
                                        {t("github.reopenPr")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {hasUnlinkActions &&
                                (checkoutCommand || hasPrActions) ? (
                                    <DropdownMenuSeparator />
                                ) : undefined}
                                {canEdit && branchName ? (
                                    <DropdownMenuItem
                                        onClick={handleUnlinkBranch}
                                    >
                                        {t("github.unlinkBranch")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {canEdit && pr ? (
                                    <DropdownMenuItem onClick={handleUnlinkPr}>
                                        {t("github.unlinkPr")}
                                    </DropdownMenuItem>
                                ) : undefined}
                                {/* Both fields linked: one more item clears the whole Git link. */}
                                {canEdit && branchName && pr ? (
                                    <DropdownMenuItem
                                        onClick={handleUnlinkGitLink}
                                        variant="destructive"
                                    >
                                        {t("github.unlinkGitLink")}
                                    </DropdownMenuItem>
                                ) : undefined}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : undefined}
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                    {branchName ? (
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                            <GitBranch
                                aria-hidden
                                className="size-3.5 shrink-0 text-muted-foreground"
                            />
                            <code
                                className="min-w-0 truncate font-mono text-code text-foreground"
                                title={checkoutCommand}
                            >
                                {branchName}
                            </code>
                            <Button
                                aria-label={t("github.copy")}
                                className="shrink-0"
                                onClick={() => {
                                    void handleCopyCheckout();
                                }}
                                size="icon-xs"
                                title={t("github.copy")}
                                type="button"
                                variant="ghost"
                            >
                                {copied ? (
                                    <Check className="size-3.5 text-emerald-500" />
                                ) : (
                                    <Copy className="size-3.5" />
                                )}
                            </Button>
                        </span>
                    ) : undefined}

                    {pr ? (
                        <a
                            className={cn(
                                "inline-flex min-w-0 items-center gap-1.5 rounded-sm text-ui underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                                PR_STATE_CLASS[pr.state]
                            )}
                            href={pr.url}
                            rel="noreferrer"
                            target="_blank"
                        >
                            <GitPullRequest
                                aria-hidden
                                className="size-3.5 shrink-0"
                            />
                            <span className="truncate">{prTitle}</span>
                            <ExternalLink
                                aria-hidden
                                className="size-3 shrink-0"
                            />
                        </a>
                    ) : canOpenPr ? (
                        <Button
                            disabled={createPr.isPending}
                            onClick={() => {
                                void handleOpenPr();
                            }}
                            size="xs"
                            title={t("github.prTarget", {
                                branch: baseBranch,
                            })}
                            type="button"
                            variant="default"
                        >
                            {createPr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : (
                                <GitPullRequest
                                    aria-hidden
                                    className="size-3.5"
                                />
                            )}
                            {t("github.openPr")}
                        </Button>
                    ) : undefined}
                </div>

                {pr ? (
                    <PrChecksSummary
                        githubToken={githubToken}
                        prNumber={pr.number}
                        repoFullName={repoFullName}
                    />
                ) : undefined}

                {diffOpen && pr && canViewDiff && repoFullName ? (
                    <PrDiffDialog
                        onClose={() => setDiffOpen(false)}
                        open
                        prNumber={pr.number}
                        prTitle={prTitle}
                        repoFullName={repoFullName}
                        token={githubToken}
                    />
                ) : undefined}

                {requestReviewOpen && pr && canRequestReview && repoFullName ? (
                    <RequestReviewDialog
                        onClose={() => setRequestReviewOpen(false)}
                        onSubmit={(reviewers) => {
                            void handleRequestReview(reviewers);
                        }}
                        open
                        pending={requestReview.isPending}
                        prNumber={pr.number}
                        repoFullName={repoFullName}
                        token={githubToken}
                    />
                ) : undefined}
            </section>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !approvePr.isPending) setApproveOpen(false);
                }}
                open={approveOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("github.approvePrTitle", {
                                number: pr?.number ?? 0,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.approvePrBody")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={approvePr.isPending}>
                            {t("github.approvePrCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={approvePr.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleApprovePr();
                            }}
                        >
                            {approvePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.approvePrConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !mergePr.isPending) setMergeOpen(false);
                }}
                open={mergeOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("github.mergePrTitle", {
                                number: pr?.number ?? 0,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.mergePrBody", {
                                base: baseBranch ?? "—",
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex flex-col gap-2 px-4 sm:px-6">
                        <p className="text-meta text-muted-foreground">
                            {t("github.mergeMethod")}
                        </p>
                        <Select
                            onValueChange={(value) => {
                                if (
                                    value === "squash" ||
                                    value === "merge" ||
                                    value === "rebase"
                                ) {
                                    setMergeMethod(value);
                                }
                            }}
                            value={mergeMethod}
                        >
                            <SelectTrigger
                                aria-label={t("github.mergeMethod")}
                                className="w-full font-mono text-code"
                            >
                                <span>{mergeMethodLabel(mergeMethod)}</span>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {MERGE_METHODS.map((method) => (
                                    <SelectItem key={method} value={method}>
                                        {mergeMethodLabel(method)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={mergePr.isPending}>
                            {t("github.mergePrCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={mergePr.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleMergeConfirm();
                            }}
                        >
                            {mergePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.mergePrConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !closePr.isPending) setCloseOpen(false);
                }}
                open={closeOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("github.closePrTitle", {
                                number: pr?.number ?? 0,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.closePrBody")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={closePr.isPending}>
                            {t("github.closePrCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={closePr.isPending}
                            onClick={(event) => {
                                event.preventDefault();
                                void handleCloseConfirm();
                            }}
                        >
                            {closePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.closePrConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Row name: the Repository alone while it holds one Git link of the Task,
 * else the Repository with that row's branch (or PR) to tell rows apart.
 */
function gitLinkRowLabel(
    link: TaskGitLink,
    repository: GitLinkRepository,
    linked: readonly { repository: GitLinkRepository }[]
): string {
    const siblings = linked.filter(
        (entry) => entry.repository.id === repository.id
    ).length;
    if (siblings <= 1) return repository.fullName;
    const detail =
        link.branchName ?? (link.pr ? `PR #${link.pr.number}` : undefined);
    return detail ? `${repository.fullName} · ${detail}` : repository.fullName;
}
