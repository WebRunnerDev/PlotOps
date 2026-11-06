import { ExternalLink, GitPullRequest, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitPullRequest as GitPR } from "@/features/git-integration/api/github-git-api";

import { useBranchPullRequests } from "@/features/git-integration/model/use-git-data";
import { PrDiffDialog } from "@/features/git-integration/ui/pr-diff-dialog";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/shadcn/ui/alert";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TaskGitTabProperties = {
    branchName?: string;
    /** Shared/base branch — hide noisy branch commit/PR lists. */
    isShared?: boolean;
    /**
     * Task-linked PR number from the GitHub panel.
     * When set, the branch PR list is hidden (panel is the single PR surface).
     */
    linkedPrNumber?: number;
    repoFullName: string;
    /** Repository caption when the Project holds several Repositories. */
    repositoryLabel?: string;
    /** Null for guest demos (fixtures load when session is guest). */
    token: null | string;
};

const PR_STATE_CLASS: Record<"merged" | GitPR["state"], string> = {
    closed: "border-red-500/40 text-red-400",
    merged: "border-violet-500/40 text-violet-400",
    open: "border-emerald-500/40 text-emerald-400",
};

/**
 * Per-Repository Git extras under the drawer GitHub panel: the shared-branch
 * notice and PRs found on the branch while no PR is linked. Commits live in
 * the panel's Commits section, across every Repository.
 */
export function TaskGitTab({
    branchName,
    isShared = false,
    linkedPrNumber,
    repoFullName,
    repositoryLabel,
    token,
}: TaskGitTabProperties) {
    const { t } = useTranslation("board");
    const [diffPr, setDiffPr] = useState<GitPR | undefined>();

    const branchEnabled = Boolean(branchName) && !isShared;
    /** Panel owns the linked PR — only list branch PRs when none is linked yet. */
    const showBranchPrs = branchEnabled && linkedPrNumber == undefined;

    const {
        data: prs = [],
        isError: prsError,
        isLoading: prsLoading,
        refetch: refetchPrs,
    } = useBranchPullRequests({
        branchName: showBranchPrs ? branchName : undefined,
        repoFullName,
        token,
    });

    if (!isShared && !showBranchPrs) return;

    return (
        <div className="flex flex-col gap-5">
            {repositoryLabel ? (
                <p className="truncate font-mono text-code text-foreground">
                    {repositoryLabel}
                </p>
            ) : undefined}
            {isShared ? (
                <Alert>
                    <AlertTitle>{t("git.sharedBranchTitle")}</AlertTitle>
                    <AlertDescription>
                        {t("git.sharedBranchBody", { branch: branchName })}
                    </AlertDescription>
                </Alert>
            ) : undefined}

            {showBranchPrs ? (
                <section className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-meta font-medium tracking-[0.06em] text-muted-foreground">
                            <GitPullRequest aria-hidden className="size-3.5" />
                            {t("git.pullRequests")}
                        </p>
                        <Button
                            aria-label={t("git.refresh")}
                            onClick={() => void refetchPrs()}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <RefreshCw className="size-3.5" />
                        </Button>
                    </div>

                    {prsLoading ? (
                        <div className="flex items-center gap-2 text-ui text-muted-foreground">
                            <Spinner className="size-3.5" />
                            {t("git.loading")}
                        </div>
                    ) : prsError ? (
                        <div className="flex flex-col items-start gap-2">
                            <p className="text-ui text-destructive">
                                {t("git.loadFailed")}
                            </p>
                            <Button
                                onClick={() => void refetchPrs()}
                                size="xs"
                                type="button"
                                variant="outline"
                            >
                                {t("git.retry")}
                            </Button>
                        </div>
                    ) : prs.length === 0 ? (
                        <p className="text-ui text-muted-foreground">
                            {t("git.noPrs")}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {prs.map((pr) => {
                                const state = prDisplayState(pr);
                                return (
                                    <li
                                        className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-2.5 ring-1 ring-foreground/8"
                                        key={pr.number}
                                    >
                                        <div className="flex min-w-0 flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    className={cn(
                                                        "shrink-0 text-meta",
                                                        PR_STATE_CLASS[state]
                                                    )}
                                                    variant="outline"
                                                >
                                                    #{pr.number} ·{" "}
                                                    {t(`prState.${state}`)}
                                                </Badge>
                                                {pr.draft ? (
                                                    <Badge
                                                        className="shrink-0 text-meta"
                                                        variant="outline"
                                                    >
                                                        {t("git.draft")}
                                                    </Badge>
                                                ) : undefined}
                                            </div>
                                            <p className="line-clamp-2 text-ui">
                                                {pr.title}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button
                                                onClick={() => setDiffPr(pr)}
                                                size="xs"
                                                type="button"
                                                variant="outline"
                                            >
                                                {t("git.viewDiff")}
                                            </Button>
                                            <Button
                                                aria-label={t(
                                                    "git.openOnGitHub"
                                                )}
                                                nativeButton={false}
                                                render={
                                                    <a
                                                        href={pr.url}
                                                        rel="noreferrer"
                                                        target="_blank"
                                                    />
                                                }
                                                size="icon-xs"
                                                type="button"
                                                variant="ghost"
                                            >
                                                <ExternalLink className="size-3.5" />
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            ) : undefined}

            {diffPr ? (
                <PrDiffDialog
                    onClose={() => setDiffPr(undefined)}
                    open
                    prNumber={diffPr.number}
                    prTitle={diffPr.title}
                    repoFullName={repoFullName}
                    token={token}
                />
            ) : undefined}
        </div>
    );
}

function prDisplayState(pr: GitPR): "closed" | "merged" | "open" {
    if (pr.merged_at) return "merged";
    return pr.state;
}
