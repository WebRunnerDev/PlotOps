import {
    Check,
    Copy,
    ExternalLink,
    GitBranch,
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

import { matchesAllowedHeadPatterns } from "@/features/boards";
import {
    fetchPullRequest,
    isGitHubApiError,
} from "@/features/git-integration/api/github-git-api";
import { PrDiffDialog } from "@/features/git-integration/ui/pr-diff-dialog";
import {
    generateBranchName,
    isSharedBranch,
    normalizeBranchName,
} from "@/features/tasks/lib/format-branch";
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
import { Spinner } from "@/shared/shadcn/ui/spinner";

const PR_STATE_CLASS: Record<NonNullable<Task["pr"]>["state"], string> = {
    closed: "text-red-500",
    merged: "text-purple-500",
    open: "text-emerald-500",
};

type TaskGithubPanelProperties = {
    allowedHeadPatterns: string[];
    baseBranch: string;
    /** Drawer edit gate (`canEditTasks && !archived`) — same Role seam as Board. */
    canEdit: boolean;
    githubToken: null | string;
    onBranchChange: (branchName: null | string) => void;
    onPrChange: (pr: null | TaskPullRequest) => void;
    repoFullName: string | undefined;
    task: Task;
};

export function TaskGithubPanel({
    allowedHeadPatterns,
    baseBranch,
    canEdit,
    githubToken,
    onBranchChange,
    onPrChange,
    repoFullName,
    task,
}: TaskGithubPanelProperties) {
    const { t } = useTranslation("board");
    const [copied, setCopied] = useState(false);
    const [linkingBranch, setLinkingBranch] = useState(false);
    const [branchDraft, setBranchDraft] = useState("");
    const [linkingPr, setLinkingPr] = useState(false);
    const [prDraft, setPrDraft] = useState("");
    const [prLoading, setPrLoading] = useState(false);
    const [diffOpen, setDiffOpen] = useState(false);
    const [pendingBranch, setPendingBranch] = useState<null | string>(null);
    const prLinkAbort = useRef<AbortController | undefined>(undefined);
    const prLinkGeneration = useRef(0);

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
        setPendingBranch(null);
    }, [task.id]);

    const branchName = task.branchName;
    const checkoutCommand = branchName
        ? `git checkout ${branchName}`
        : undefined;
    const canFetchGithub = Boolean(githubToken && repoFullName);

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
            {canFetchGithub ? (
                <Button
                    className="self-start"
                    onClick={() => setDiffOpen(true)}
                    size="xs"
                    type="button"
                    variant="outline"
                >
                    {t("git.viewDiff")}
                </Button>
            ) : undefined}
        </div>
    ) : linkingPr && canEdit ? (
        <div className="flex flex-col gap-2">
            <p className="text-ui text-muted-foreground">
                {t("github.linkPrHint")}
            </p>
            <div className="flex items-center gap-2">
                <Input
                    aria-label={t("github.linkPrPlaceholder")}
                    autoFocus
                    className="font-mono text-code"
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
            {canEdit ? (
                <Button
                    className="self-start"
                    disabled={!canFetchGithub}
                    onClick={() => setLinkingPr(true)}
                    size="xs"
                    title={
                        canFetchGithub ? undefined : t("github.prNeedsGithub")
                    }
                    type="button"
                    variant="outline"
                >
                    <GitPullRequest aria-hidden className="size-4" />
                    {t("github.linkPr")}
                </Button>
            ) : undefined}
        </div>
    );

    return (
        <>
            <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
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
                            <div className="flex items-center gap-2">
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
                                <div className="flex items-center gap-2">
                                    <Input
                                        aria-label={t(
                                            "github.linkBranchPlaceholder"
                                        )}
                                        autoFocus
                                        className="font-mono text-code"
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
        </>
    );
}
