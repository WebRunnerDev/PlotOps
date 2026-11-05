import { Link } from "@tanstack/react-router";
import {
    Check,
    Copy,
    ExternalLink,
    GitBranch,
    GitCommit,
    GitPullRequest,
    Link2,
    Sparkles,
    Unlink,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    GitLinkChange,
    GitLinkRepository,
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
    groupGitLinksByRepository,
    pickDefaultRepositoryId,
    repositoriesWithoutGitLink,
} from "@/features/tasks/lib/task-git-links";
import { useGitLinkRepositoryStore } from "@/features/tasks/model/git-link-repository-store";
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

type PendingBranch = { branchName: string; repositoryId: string };

type RepositoryGitLinkSectionProperties = {
    /** Base branch of this Repository on the Board; null unless Development Board. */
    baseBranch: null | string;
    canEdit: boolean;
    githubToken: null | string;
    link: TaskGitLink | undefined;
    onChange: (change: GitLinkChange) => void;
    /** Branch picked in the section — the panel checks Allowed head patterns first. */
    onRequestBranch: (branchName: string) => void;
    projectId: string;
    repository: GitLinkRepository;
    /** Several Repositories in the Project: show the Repository header. */
    showRepositoryHeader: boolean;
    task: Task;
};

type TaskGithubPanelProperties = {
    /** Board-level Allowed head patterns — shared by every Repository. */
    allowedHeadPatterns: string[];
    /** Base branch per Repository id; null for a Repository / non-Development Board. */
    baseBranchFor: (repositoryId: string) => null | string;
    boardId: string;
    /** Drawer edit gate (`canEditTasks && !archived`) — same Role seam as Board. */
    canEdit: boolean;
    githubToken: null | string;
    onGitLinkChange: (repositoryId: string, change: GitLinkChange) => void;
    onLinkedCommitChange: (linkedCommitSha: null | string) => void;
    /** Project id for connect deep-link when no Repository is linked. */
    projectId: string;
    /** The Project's Repositories, in Project order. */
    repositories: GitLinkRepository[];
    task: Task;
};

/**
 * Drawer GitHub block (ADR 0035): Git links grouped by Repository, then one
 * Create branch / PR section for a Repository the Task has no Git link for.
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

    const [chosenRepositoryId, setChosenRepositoryId] = useState<
        string | undefined
    >();
    const [pendingBranch, setPendingBranch] = useState<null | PendingBranch>(
        null
    );
    const [linkingCommit, setLinkingCommit] = useState(false);
    const [commitDraft, setCommitDraft] = useState("");
    const [commitLoading, setCommitLoading] = useState(false);
    const commitLinkAbort = useRef<AbortController | undefined>(undefined);
    const commitLinkGeneration = useRef(0);

    useEffect(() => {
        commitLinkAbort.current?.abort();
        commitLinkAbort.current = undefined;
        commitLinkGeneration.current += 1;
        setChosenRepositoryId(undefined);
        setPendingBranch(null);
        setLinkingCommit(false);
        setCommitDraft("");
        setCommitLoading(false);
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
    const linked = groupGitLinksByRepository(
        repositories,
        task.gitLinks
    ).filter((entry) => entry.link !== undefined);
    const unlinked = repositoriesWithoutGitLink(repositories, task.gitLinks);
    const newLinkRepositoryId = pickDefaultRepositoryId(
        unlinked,
        chosenRepositoryId ?? lastRepositoryId
    );
    const newLinkRepository = unlinked.find(
        (repository) => repository.id === newLinkRepositoryId
    );
    const canFetchGithub = Boolean(githubToken);

    const changeGitLink = (repositoryId: string, change: GitLinkChange) => {
        if (!linked.some((entry) => entry.repository.id === repositoryId)) {
            setLastRepositoryId(user?.id, boardId, repositoryId);
        }
        onGitLinkChange(repositoryId, change);
    };

    const linkBranch = (repositoryId: string, branchName: string) => {
        changeGitLink(repositoryId, { branchName });
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

    const handleLinkCommitConfirm = async () => {
        if (!canEdit) return;
        const sha = parseCommitSha(commitDraft);
        if (!sha) {
            toast.error(t("github.commitRequired"));
            return;
        }
        if (!githubToken || repositories.length === 0) {
            toast.error(t("github.commitNeedsGithub"));
            return;
        }

        commitLinkAbort.current?.abort();
        const controller = new AbortController();
        commitLinkAbort.current = controller;
        const generation = ++commitLinkGeneration.current;

        setCommitLoading(true);
        try {
            const remote = await findCommitInRepositories(
                repositories,
                sha,
                githubToken,
                controller.signal
            );
            if (generation !== commitLinkGeneration.current) return;

            onLinkedCommitChange(remote.sha);
            setLinkingCommit(false);
            setCommitDraft("");
            toast.success(
                t("github.commitLinkedToast", {
                    sha: remote.sha.slice(0, 7),
                })
            );
        } catch (error) {
            if (generation !== commitLinkGeneration.current) return;
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
            if (generation === commitLinkGeneration.current) {
                setCommitLoading(false);
            }
        }
    };

    const handleUnlinkCommit = () => {
        if (!canEdit) return;
        onLinkedCommitChange(null);
        setLinkingCommit(false);
        setCommitDraft("");
    };

    const singleBaseBranch =
        multiRepository || !repositories[0]
            ? null
            : baseBranchFor(repositories[0].id);

    return (
        <>
            <div className="flex min-w-0 flex-col gap-3 rounded-none bg-muted/40 p-3 ring-1 ring-primary/20">
                <div className="flex flex-col gap-0.5">
                    <p className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                        {t("github.title")}
                    </p>
                    {multiRepository ? undefined : (
                        <p className="text-meta font-mono text-muted-foreground">
                            {singleBaseBranch
                                ? t("github.prTarget", {
                                      branch: singleBaseBranch,
                                  })
                                : t("github.noBaseBranch")}
                        </p>
                    )}
                </div>

                {linked.map(({ link, repository }) => (
                    <RepositoryGitLinkSection
                        baseBranch={baseBranchFor(repository.id)}
                        canEdit={canEdit}
                        githubToken={githubToken}
                        key={repository.id}
                        link={link}
                        onChange={(change) =>
                            changeGitLink(repository.id, change)
                        }
                        onRequestBranch={(branchName) =>
                            requestBranch(repository.id, branchName)
                        }
                        projectId={projectId}
                        repository={repository}
                        showRepositoryHeader={multiRepository}
                        task={task}
                    />
                ))}

                {newLinkRepository && (canEdit || linked.length === 0) ? (
                    <div
                        className={cn(
                            "flex min-w-0 flex-col gap-3",
                            multiRepository &&
                                linked.length > 0 &&
                                "border-t border-primary/15 pt-3"
                        )}
                    >
                        {multiRepository && canEdit ? (
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <p className="text-meta text-muted-foreground">
                                    {linked.length > 0
                                        ? t("github.addGitLink")
                                        : t("github.repository")}
                                </p>
                                {unlinked.length > 1 ? (
                                    <Select
                                        onValueChange={(value) => {
                                            if (typeof value !== "string") {
                                                return;
                                            }
                                            setChosenRepositoryId(value);
                                            setLastRepositoryId(
                                                user?.id,
                                                boardId,
                                                value
                                            );
                                        }}
                                        value={newLinkRepository.id}
                                    >
                                        <SelectTrigger
                                            aria-label={t("github.repository")}
                                            className="w-full font-mono text-code"
                                        >
                                            <span className="truncate">
                                                {newLinkRepository.fullName}
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent
                                            alignItemWithTrigger={false}
                                        >
                                            {unlinked.map((repository) => (
                                                <SelectItem
                                                    key={repository.id}
                                                    value={repository.id}
                                                >
                                                    {repository.fullName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="truncate font-mono text-code text-foreground">
                                        {newLinkRepository.fullName}
                                    </p>
                                )}
                                <p className="text-meta font-mono text-muted-foreground">
                                    {baseBranchFor(newLinkRepository.id)
                                        ? t("github.prTarget", {
                                              branch: baseBranchFor(
                                                  newLinkRepository.id
                                              ),
                                          })
                                        : t("github.noBaseBranch")}
                                </p>
                            </div>
                        ) : undefined}
                        <RepositoryGitLinkSection
                            baseBranch={baseBranchFor(newLinkRepository.id)}
                            canEdit={canEdit}
                            githubToken={githubToken}
                            key={`new:${newLinkRepository.id}`}
                            link={undefined}
                            onChange={(change) =>
                                changeGitLink(newLinkRepository.id, change)
                            }
                            onRequestBranch={(branchName) =>
                                requestBranch(newLinkRepository.id, branchName)
                            }
                            projectId={projectId}
                            repository={newLinkRepository}
                            showRepositoryHeader={false}
                            task={task}
                        />
                    </div>
                ) : undefined}

                <div className="flex flex-col gap-2 border-t border-primary/15 pt-3">
                    <p className="text-ui text-muted-foreground">
                        {t("github.smartCommitsHint", { key: task.key })}
                    </p>

                    {task.linkedCommitSha ? (
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-code text-muted-foreground">
                                <GitCommit
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                                {task.linkedCommitSha.slice(0, 7)}
                            </span>
                            {canEdit ? (
                                <Button
                                    aria-label={t("github.unlinkCommit")}
                                    onClick={handleUnlinkCommit}
                                    size="icon-xs"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Unlink className="size-3.5" />
                                </Button>
                            ) : undefined}
                        </div>
                    ) : linkingCommit && canEdit ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-ui text-muted-foreground">
                                {t("github.linkCommitHint")}
                            </p>
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                <Input
                                    aria-label={t(
                                        "github.linkCommitPlaceholder"
                                    )}
                                    autoFocus
                                    className="min-w-0 font-mono text-code"
                                    disabled={commitLoading}
                                    onChange={(event) =>
                                        setCommitDraft(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void handleLinkCommitConfirm();
                                        }
                                        if (
                                            event.key === "Escape" &&
                                            !commitLoading
                                        ) {
                                            setLinkingCommit(false);
                                            setCommitDraft("");
                                        }
                                    }}
                                    placeholder={t(
                                        "github.linkCommitPlaceholder"
                                    )}
                                    value={commitDraft}
                                />
                                <Button
                                    aria-label={t("github.linkCommitConfirm")}
                                    disabled={commitLoading}
                                    onClick={() => {
                                        void handleLinkCommitConfirm();
                                    }}
                                    size="icon-sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {commitLoading ? <Spinner /> : <Check />}
                                </Button>
                                <Button
                                    aria-label={t("github.linkCancel")}
                                    disabled={commitLoading}
                                    onClick={() => {
                                        setLinkingCommit(false);
                                        setCommitDraft("");
                                    }}
                                    size="icon-sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <X />
                                </Button>
                            </div>
                        </div>
                    ) : canEdit ? (
                        <Button
                            disabled={!canFetchGithub}
                            onClick={() => setLinkingCommit(true)}
                            size="xs"
                            title={
                                canFetchGithub
                                    ? undefined
                                    : t("github.commitNeedsGithub")
                            }
                            type="button"
                            variant="outline"
                        >
                            <Link2 aria-hidden className="size-4" />
                            {t("github.linkCommit")}
                        </Button>
                    ) : undefined}
                </div>
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

/** Branch, PR and PR actions for one Repository's Git link (ADR 0035). */
function RepositoryGitLinkSection({
    baseBranch,
    canEdit,
    githubToken,
    link,
    onChange,
    onRequestBranch,
    projectId,
    repository,
    showRepositoryHeader,
    task,
}: RepositoryGitLinkSectionProperties) {
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
    const [linkingBranch, setLinkingBranch] = useState(false);
    const [branchDraft, setBranchDraft] = useState("");
    const [linkingPr, setLinkingPr] = useState(false);
    const [prDraft, setPrDraft] = useState("");
    const [prLoading, setPrLoading] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [approveOpen, setApproveOpen] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [requestReviewOpen, setRequestReviewOpen] = useState(false);
    const [mergeMethod, setMergeMethod] = useState<GitMergeMethod>("squash");
    const prLinkAbort = useRef<AbortController | undefined>(undefined);
    const prLinkGeneration = useRef(0);

    const repoFullName = repository.fullName;
    const branchName = link?.branchName;
    const pr = link?.pr;

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
        prLinkAbort.current?.abort();
        prLinkAbort.current = undefined;
        prLinkGeneration.current += 1;
        setCopied(false);
        setLinkingBranch(false);
        setBranchDraft("");
        setLinkingPr(false);
        setPrDraft("");
        setPrLoading(false);
        setDiffOpen(false);
        setMergeOpen(false);
        setCloseOpen(false);
        setRequestReviewOpen(false);
        setMergeMethod("squash");
    }, [task.id, repository.id]);

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

    const handleGenerate = () => {
        if (!canEdit) return;
        const generated = generateBranchName(task.key, task.title, task.type);
        setLinkingBranch(false);
        onRequestBranch(generated);
    };

    const handleLinkBranchConfirm = () => {
        if (!canEdit) return;
        const next = normalizeBranchName(branchDraft);
        if (!next) {
            toast.error(t("github.branchRequired"));
            return;
        }
        setLinkingBranch(false);
        setBranchDraft("");
        onRequestBranch(next);
    };

    const handleUnlinkBranch = () => {
        if (!canEdit) return;
        setLinkingBranch(false);
        onChange({ branchName: null });
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

    const handleUnlinkGitLink = () => {
        if (!canEdit) return;
        prLinkAbort.current?.abort();
        prLinkGeneration.current += 1;
        setLinkingBranch(false);
        setLinkingPr(false);
        setPrDraft("");
        setDiffOpen(false);
        onChange({ branchName: null, pr: null });
    };

    const handleLinkPrConfirm = async () => {
        if (!canEdit) return;
        const number = parsePrNumber(prDraft);
        if (number == undefined) {
            toast.error(t("github.prRequired"));
            return;
        }
        if (!githubToken || !repoFullName) {
            toast.error(t("github.prNeedsGithub"));
            return;
        }

        prLinkAbort.current?.abort();
        const controller = new AbortController();
        prLinkAbort.current = controller;
        const generation = ++prLinkGeneration.current;

        setPrLoading(true);
        try {
            const remote = await fetchPullRequest(
                repoFullName,
                number,
                githubToken,
                controller.signal
            );
            if (generation !== prLinkGeneration.current) return;

            const nextPr: TaskPullRequest = {
                number: remote.number,
                state: remote.merged_at ? "merged" : remote.state,
                url: remote.url,
            };
            onChange({ pr: nextPr });
            setLinkingPr(false);
            setPrDraft("");
            toast.success(t("github.prLinkedToast", { number: nextPr.number }));
        } catch (error) {
            if (generation !== prLinkGeneration.current) return;
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
            if (generation === prLinkGeneration.current) {
                setPrLoading(false);
            }
        }
    };

    const handleUnlinkPr = () => {
        if (!canEdit) return;
        onChange({ pr: null });
        setLinkingPr(false);
        setPrDraft("");
        setDiffOpen(false);
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

    const prSection = pr ? (
        <div className="flex flex-col gap-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <a
                        className={cn(
                            "inline-flex min-w-0 items-center gap-1.5 text-ui underline-offset-4 hover:underline",
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
                        <span className="truncate">
                            {t("github.prLink", {
                                number: pr.number,
                                state: t(`prState.${pr.state}`),
                            })}
                        </span>
                        <ExternalLink aria-hidden className="size-3 shrink-0" />
                    </a>
                    {canViewDiff ? (
                        <button
                            className="shrink-0 rounded-sm text-meta text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setDiffOpen(true)}
                            type="button"
                        >
                            {t("git.viewDiff")}
                        </button>
                    ) : undefined}
                </div>
                {canEdit ? (
                    <Button
                        aria-label={t("github.unlinkPr")}
                        className="shrink-0"
                        onClick={handleUnlinkPr}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                    >
                        <Unlink className="size-3.5" />
                    </Button>
                ) : undefined}
            </div>
            <PrChecksSummary
                githubToken={githubToken}
                prNumber={pr.number}
                repoFullName={repoFullName}
            />
            {canApprovePr ||
            canRequestReview ||
            canMergePr ||
            canClosePr ||
            canReopenPr ? (
                <div className="flex flex-wrap items-center gap-2">
                    {canApprovePr ? (
                        <Button
                            disabled={writeActionPending}
                            onClick={() => setApproveOpen(true)}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {approvePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.approvePr")}
                        </Button>
                    ) : undefined}
                    {canRequestReview ? (
                        <Button
                            disabled={writeActionPending}
                            onClick={() => setRequestReviewOpen(true)}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {requestReview.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.requestReview")}
                        </Button>
                    ) : undefined}
                    {canMergePr ? (
                        <Button
                            disabled={writeActionPending}
                            onClick={() => setMergeOpen(true)}
                            size="xs"
                            type="button"
                            variant="default"
                        >
                            {mergePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.mergePr")}
                        </Button>
                    ) : undefined}
                    {canClosePr ? (
                        <Button
                            disabled={writeActionPending}
                            onClick={() => setCloseOpen(true)}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {closePr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.closePr")}
                        </Button>
                    ) : undefined}
                    {canReopenPr ? (
                        <Button
                            disabled={writeActionPending}
                            onClick={() => {
                                void handleReopenPr();
                            }}
                            size="xs"
                            type="button"
                            variant="outline"
                        >
                            {reopenPr.isPending ? (
                                <Spinner className="size-3.5" />
                            ) : undefined}
                            {t("github.reopenPr")}
                        </Button>
                    ) : undefined}
                </div>
            ) : undefined}
        </div>
    ) : linkingPr && canEdit ? (
        <div className="flex flex-col gap-2">
            <p className="text-ui text-muted-foreground">
                {t("github.linkPrHint")}
            </p>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                    aria-label={t("github.linkPrPlaceholder")}
                    autoFocus
                    className="min-w-0 font-mono text-code"
                    disabled={prLoading}
                    onChange={(event) => setPrDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            void handleLinkPrConfirm();
                        }
                        if (event.key === "Escape" && !prLoading) {
                            setLinkingPr(false);
                            setPrDraft("");
                        }
                    }}
                    placeholder={t("github.linkPrPlaceholder")}
                    value={prDraft}
                />
                <Button
                    aria-label={t("github.linkPrConfirm")}
                    disabled={prLoading}
                    onClick={() => {
                        void handleLinkPrConfirm();
                    }}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                >
                    {prLoading ? <Spinner /> : <Check />}
                </Button>
                <Button
                    aria-label={t("github.linkCancel")}
                    disabled={prLoading}
                    onClick={() => {
                        setLinkingPr(false);
                        setPrDraft("");
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                >
                    <X />
                </Button>
            </div>
        </div>
    ) : (
        <div className="flex flex-col gap-2">
            <p className="text-ui text-muted-foreground">
                {branchName ? t("github.noPr") : t("github.noPrSkipped")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                {canOpenPr ? (
                    <Button
                        disabled={createPr.isPending}
                        onClick={() => {
                            void handleOpenPr();
                        }}
                        size="xs"
                        type="button"
                        variant="default"
                    >
                        {createPr.isPending ? (
                            <Spinner className="size-3.5" />
                        ) : (
                            <GitPullRequest aria-hidden className="size-4" />
                        )}
                        {t("github.openPr")}
                    </Button>
                ) : undefined}
                {canEdit ? (
                    <Button
                        disabled={!canFetchGithub}
                        onClick={() => setLinkingPr(true)}
                        size="xs"
                        title={
                            canFetchGithub
                                ? undefined
                                : t("github.prNeedsGithub")
                        }
                        type="button"
                        variant="outline"
                    >
                        <Link2 aria-hidden className="size-4" />
                        {t("github.linkPr")}
                    </Button>
                ) : undefined}
            </div>
        </div>
    );

    return (
        <>
            <section
                aria-label={showRepositoryHeader ? repoFullName : undefined}
                className={cn(
                    "flex min-w-0 flex-col gap-3",
                    showRepositoryHeader &&
                        "border-t border-primary/15 pt-3 first:border-t-0 first:pt-0"
                )}
            >
                {showRepositoryHeader ? (
                    <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <p className="inline-flex min-w-0 items-center gap-1.5 text-ui font-medium text-foreground">
                                <span className="truncate font-mono text-code">
                                    {repoFullName}
                                </span>
                                {branchName && !pr ? (
                                    <span className="shrink-0 border border-primary/15 px-1 text-meta font-normal text-muted-foreground">
                                        {t("github.noPrTag")}
                                    </span>
                                ) : undefined}
                            </p>
                            <p className="text-meta font-mono text-muted-foreground">
                                {baseBranch
                                    ? t("github.prTarget", {
                                          branch: baseBranch,
                                      })
                                    : t("github.noBaseBranch")}
                            </p>
                        </div>
                        {link && canEdit ? (
                            <Button
                                aria-label={t("github.unlinkGitLink", {
                                    repository: repoFullName,
                                })}
                                className="shrink-0"
                                onClick={handleUnlinkGitLink}
                                size="icon-xs"
                                title={t("github.unlinkGitLink", {
                                    repository: repoFullName,
                                })}
                                type="button"
                                variant="ghost"
                            >
                                <Unlink className="size-3.5" />
                            </Button>
                        ) : undefined}
                    </div>
                ) : undefined}

                {branchName ? (
                    <>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex min-w-0 items-center gap-1.5 text-ui text-muted-foreground">
                                    <GitBranch
                                        aria-hidden
                                        className="size-3.5 shrink-0"
                                    />
                                    {t("github.checkout")}
                                </span>
                                {canEdit ? (
                                    <Button
                                        aria-label={t("github.unlinkBranch")}
                                        onClick={handleUnlinkBranch}
                                        size="icon-xs"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <Unlink className="size-3.5" />
                                    </Button>
                                ) : undefined}
                            </div>
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                <code className="min-w-0 flex-1 truncate rounded-none bg-background px-2.5 py-1.5 font-mono text-code ring-1 ring-primary/15">
                                    {checkoutCommand}
                                </code>
                                <Button
                                    aria-label={t("github.copy")}
                                    onClick={() => {
                                        void handleCopyCheckout();
                                    }}
                                    size="icon-sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {copied ? (
                                        <Check className="text-emerald-500" />
                                    ) : (
                                        <Copy />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {prSection}
                    </>
                ) : (
                    <>
                        {prSection}

                        {linkingBranch && canEdit ? (
                            <div className="flex flex-col gap-2">
                                <p className="text-ui text-muted-foreground">
                                    {t("github.linkBranchHint")}
                                </p>
                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                    <Input
                                        aria-label={t(
                                            "github.linkBranchPlaceholder"
                                        )}
                                        autoFocus
                                        className="min-w-0 font-mono text-code"
                                        onChange={(event) =>
                                            setBranchDraft(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                handleLinkBranchConfirm();
                                            }
                                            if (event.key === "Escape") {
                                                setLinkingBranch(false);
                                                setBranchDraft("");
                                            }
                                        }}
                                        placeholder={t(
                                            "github.linkBranchPlaceholder"
                                        )}
                                        value={branchDraft}
                                    />
                                    <Button
                                        aria-label={t("github.linkConfirm")}
                                        onClick={handleLinkBranchConfirm}
                                        size="icon-sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        <Check />
                                    </Button>
                                    <Button
                                        aria-label={t("github.linkCancel")}
                                        onClick={() => {
                                            setLinkingBranch(false);
                                            setBranchDraft("");
                                        }}
                                        size="icon-sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <X />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-2 rounded-none border border-primary/15 px-2.5 py-1.5">
                                <span className="inline-flex min-w-0 items-center gap-1.5 text-ui text-muted-foreground">
                                    <GitBranch
                                        aria-hidden
                                        className="size-3.5 shrink-0"
                                    />
                                    {t("github.skipBranch")}
                                </span>
                                {canEdit ? (
                                    <div className="flex shrink-0 gap-1">
                                        <Button
                                            onClick={handleGenerate}
                                            size="icon-xs"
                                            title={t("github.generateBranch")}
                                            type="button"
                                            variant="ghost"
                                        >
                                            <Sparkles
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                setLinkingBranch(true)
                                            }
                                            size="icon-xs"
                                            title={t("github.linkBranch")}
                                            type="button"
                                            variant="ghost"
                                        >
                                            <Link2
                                                aria-hidden
                                                className="size-3.5"
                                            />
                                        </Button>
                                    </div>
                                ) : undefined}
                            </div>
                        )}
                    </>
                )}

                {diffOpen && pr && canViewDiff && repoFullName ? (
                    <PrDiffDialog
                        onClose={() => setDiffOpen(false)}
                        open
                        prNumber={pr.number}
                        prTitle={t("github.prLink", {
                            number: pr.number,
                            state: t(`prState.${pr.state}`),
                        })}
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
                            <SelectTrigger className="w-full font-mono text-code">
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
