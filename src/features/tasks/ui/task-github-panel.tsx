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

import type { Task, TaskPullRequest } from "@/features/tasks/model/types";

import { useAuth } from "@/features/auth";
import { matchesAllowedHeadPatterns } from "@/features/boards";
import {
    fetchCommitBySha,
    fetchPullRequest,
    gitHubWriteErrorKind,
    type GitMergeMethod,
    isGitHubApiError,
} from "@/features/git-integration/api/github-git-api";
import { canWriteGithubPr } from "@/features/git-integration/lib/can-write-github-pr";
import { defaultPullRequestTitle } from "@/features/git-integration/lib/default-pull-request-title";
import {
    useCreatePullRequest,
    useMergePullRequest,
} from "@/features/git-integration/model/use-github-pr-writes";
import { PrDiffDialog } from "@/features/git-integration/ui/pr-diff-dialog";
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

type TaskGithubPanelProperties = {
    allowedHeadPatterns: string[];
    baseBranch: string;
    /** Drawer edit gate (`canEditTasks && !archived`) — same Role seam as Board. */
    canEdit: boolean;
    githubToken: null | string;
    onBranchChange: (branchName: null | string) => void;
    onLinkedCommitChange: (linkedCommitSha: null | string) => void;
    onPrChange: (pr: null | TaskPullRequest) => void;
    /** Project id for connect deep-link when repo is missing. */
    projectId: string;
    repoFullName: string | undefined;
    task: Task;
};

export function TaskGithubPanel({
    allowedHeadPatterns,
    baseBranch,
    canEdit,
    githubToken,
    onBranchChange,
    onLinkedCommitChange,
    onPrChange,
    projectId,
    repoFullName,
    task,
}: TaskGithubPanelProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const { isSettled, role } = useProjectAccess(projectId);
    const createPr = useCreatePullRequest();
    const mergePr = useMergePullRequest();

    const [copied, setCopied] = useState(false);
    const [linkingBranch, setLinkingBranch] = useState(false);
    const [branchDraft, setBranchDraft] = useState("");
    const [linkingPr, setLinkingPr] = useState(false);
    const [linkingCommit, setLinkingCommit] = useState(false);
    const [commitDraft, setCommitDraft] = useState("");
    const [commitLoading, setCommitLoading] = useState(false);
    const [prDraft, setPrDraft] = useState("");
    const [prLoading, setPrLoading] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [pendingBranch, setPendingBranch] = useState<null | string>(null);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeMethod, setMergeMethod] = useState<GitMergeMethod>("squash");
    const prLinkAbort = useRef<AbortController | undefined>(undefined);
    const commitLinkAbort = useRef<AbortController | undefined>(undefined);
    const prLinkGeneration = useRef(0);
    const commitLinkGeneration = useRef(0);

    const canWritePr =
        isSettled &&
        canWriteGithubPr({
            isGuest: isGuest(),
            role,
            task,
            userId: user?.id,
        });

    useEffect(() => {
        prLinkAbort.current?.abort();
        prLinkAbort.current = undefined;
        commitLinkAbort.current?.abort();
        commitLinkAbort.current = undefined;
        prLinkGeneration.current += 1;
        commitLinkGeneration.current += 1;
        setCopied(false);
        setLinkingBranch(false);
        setBranchDraft("");
        setLinkingPr(false);
        setLinkingCommit(false);
        setCommitDraft("");
        setCommitLoading(false);
        setPrDraft("");
        setPrLoading(false);
        setDiffOpen(false);
        setPendingBranch(null);
        setMergeOpen(false);
        setMergeMethod("squash");
    }, [task.id]);

    const branchName = task.branchName;
    const checkoutCommand = branchName
        ? `git checkout ${branchName}`
        : undefined;
    const canFetchGithub = Boolean(githubToken && repoFullName);
    const headIsShared = Boolean(branchName && isSharedBranch(branchName));
    const canOpenPr =
        canWritePr &&
        canFetchGithub &&
        Boolean(branchName) &&
        !task.pr &&
        !headIsShared;
    const canMergePr =
        canWritePr &&
        canFetchGithub &&
        task.pr?.state === "open" &&
        !createPr.isPending &&
        !mergePr.isPending;

    if (githubPanelNeedsRepo(repoFullName)) {
        return (
            <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                <div className="flex flex-col gap-0.5">
                    <p className="text-meta text-muted-foreground">
                        {t("github.title")}
                    </p>
                    <p className="text-ui text-muted-foreground">
                        {t("github.connectRepo")}
                    </p>
                </div>
                {branchName ? (
                    <p className="min-w-0 truncate font-mono text-code text-muted-foreground">
                        {branchName}
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
        applyBranch(generated);
    };

    const applyBranch = (next: string) => {
        if (!canEdit) return;
        if (!matchesAllowedHeadPatterns(next, allowedHeadPatterns)) {
            setPendingBranch(next);
            return;
        }
        onBranchChange(next);
        if (isSharedBranch(next)) {
            toast.message(t("github.sharedLinkedToast", { branch: next }));
        }
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
        applyBranch(next);
    };

    const handleUnlinkBranch = () => {
        if (!canEdit) return;
        setLinkingBranch(false);
        onBranchChange(null);
    };

    const handleOpenPr = async () => {
        if (!canOpenPr || !githubToken || !repoFullName || !branchName) return;

        try {
            const remote = await createPr.mutateAsync({
                base: baseBranch,
                head: branchName,
                repoFullName,
                title: defaultPullRequestTitle(task),
                token: githubToken,
            });
            const pr: TaskPullRequest = {
                number: remote.number,
                state: remote.merged_at ? "merged" : remote.state,
                url: remote.url,
            };
            onPrChange(pr);
            toast.success(t("github.openPrToast", { number: pr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.openPrFailed");
        }
    };

    const handleMergeConfirm = async () => {
        if (!canMergePr || !githubToken || !repoFullName || !task.pr) return;

        try {
            await mergePr.mutateAsync({
                commitTitle: defaultPullRequestTitle(task),
                headBranchName: branchName,
                mergeMethod,
                prNumber: task.pr.number,
                repoFullName,
                token: githubToken,
            });
            onPrChange({
                ...task.pr,
                state: "merged",
            });
            setMergeOpen(false);
            toast.success(t("github.mergePrToast", { number: task.pr.number }));
        } catch (error) {
            toastWriteFailure(error, "github.mergePrFailed");
        }
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

            const pr: TaskPullRequest = {
                number: remote.number,
                state: remote.merged_at ? "merged" : remote.state,
                url: remote.url,
            };
            onPrChange(pr);
            setLinkingPr(false);
            setPrDraft("");
            toast.success(t("github.prLinkedToast", { number: pr.number }));
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
        onPrChange(null);
        setLinkingPr(false);
        setPrDraft("");
        setDiffOpen(false);
    };

    const handleLinkCommitConfirm = async () => {
        if (!canEdit) return;
        const sha = parseCommitSha(commitDraft);
        if (!sha) {
            toast.error(t("github.commitRequired"));
            return;
        }
        if (!githubToken || !repoFullName) {
            toast.error(t("github.commitNeedsGithub"));
            return;
        }

        commitLinkAbort.current?.abort();
        const controller = new AbortController();
        commitLinkAbort.current = controller;
        const generation = ++commitLinkGeneration.current;

        setCommitLoading(true);
        try {
            const remote = await fetchCommitBySha(
                repoFullName,
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

    const prSection = task.pr ? (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <a
                    className={cn(
                        "inline-flex min-w-0 items-center gap-1.5 text-ui underline-offset-4 hover:underline",
                        PR_STATE_CLASS[task.pr.state]
                    )}
                    href={task.pr.url}
                    rel="noreferrer"
                    target="_blank"
                >
                    <GitPullRequest aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">
                        {t("github.prLink", {
                            number: task.pr.number,
                            state: t(`prState.${task.pr.state}`),
                        })}
                    </span>
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
                {canEdit ? (
                    <Button
                        aria-label={t("github.unlinkPr")}
                        onClick={handleUnlinkPr}
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                    >
                        <Unlink className="size-3.5" />
                    </Button>
                ) : undefined}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {canFetchGithub ? (
                    <Button
                        onClick={() => setDiffOpen(true)}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        {t("git.viewDiff")}
                    </Button>
                ) : undefined}
                {canMergePr ? (
                    <Button
                        disabled={mergePr.isPending}
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
            </div>
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
            <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
                <div className="flex flex-col gap-0.5">
                    <p className="text-meta text-muted-foreground">
                        {t("github.title")}
                    </p>
                    <p className="text-meta font-mono text-muted-foreground">
                        {t("github.prTarget", { branch: baseBranch })}
                    </p>
                </div>

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
                                <code className="min-w-0 flex-1 truncate rounded-md bg-background px-2.5 py-1.5 text-code ring-1 ring-foreground/10">
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
                            <div className="flex items-center justify-between gap-2 rounded-md border border-foreground/10 px-2.5 py-1.5">
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

                <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
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

                {diffOpen && task.pr && githubToken && repoFullName && (
                    <PrDiffDialog
                        onClose={() => setDiffOpen(false)}
                        open
                        prNumber={task.pr.number}
                        prTitle={t("github.prLink", {
                            number: task.pr.number,
                            state: t(`prState.${task.pr.state}`),
                        })}
                        repoFullName={repoFullName}
                        token={githubToken}
                    />
                )}
            </div>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open) setPendingBranch(null);
                }}
                open={Boolean(pendingBranch)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("github.patternMismatchTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.patternMismatchBody", {
                                branch: pendingBranch ?? "",
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
                                onBranchChange(next);
                                if (isSharedBranch(next)) {
                                    toast.message(
                                        t("github.sharedLinkedToast", {
                                            branch: next,
                                        })
                                    );
                                }
                            }}
                        >
                            {t("github.patternMismatchConfirm")}
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
                                number: task.pr?.number ?? 0,
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("github.mergePrBody", { base: baseBranch })}
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
        </>
    );
}
