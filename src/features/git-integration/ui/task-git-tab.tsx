import {
    GitCommit,
    GitPullRequest,
    ExternalLink,
    RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitPullRequest as GitPR } from "@/features/git-integration/api/github-git-api";

import {
    useBranchCommits,
    useBranchPullRequests,
} from "@/features/git-integration/model/use-git-data";
import { PrDiffDialog } from "@/features/git-integration/ui/pr-diff-dialog";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/shadcn/ui/alert";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TaskGitTabProperties = {
    branchName: string;
    /** Shared/base branch — hide noisy commit/PR lists. */
    isShared?: boolean;
    repoFullName: string;
    token: string;
};

const PR_STATE_CLASS: Record<GitPR["state"] | "merged", string> = {
    closed: "border-red-500/40 text-red-400",
    merged: "border-violet-500/40 text-violet-400",
    open: "border-emerald-500/40 text-emerald-400",
};

function prDisplayState(pr: GitPR): "closed" | "merged" | "open" {
    if (pr.merged_at) return "merged";
    return pr.state;
}

export function TaskGitTab({
    branchName,
    isShared = false,
    repoFullName,
    token,
}: TaskGitTabProperties) {
    const { t } = useTranslation("board");
    const [diffPr, setDiffPr] = useState<GitPR | undefined>();

    const {
        data: prs = [],
        isLoading: prsLoading,
        refetch: refetchPrs,
    } = useBranchPullRequests({
        branchName: isShared ? undefined : branchName,
        repoFullName,
        token,
    });

    const {
        data: commits = [],
        isLoading: commitsLoading,
        refetch: refetchCommits,
    } = useBranchCommits({
        branchName: isShared ? undefined : branchName,
        repoFullName,
        token,
    });

    const handleRefresh = () => {
        if (isShared) return;
        void refetchPrs();
        void refetchCommits();
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <p className="text-meta text-muted-foreground">
                    {t("git.branchLabel")}
                    <span className="ml-1 font-mono text-foreground">
                        {branchName}
                    </span>
                </p>
                {!isShared ? (
                    <Button
                        aria-label={t("git.refresh")}
                        onClick={handleRefresh}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                    >
                        <RefreshCw className="size-3.5" />
                    </Button>
                ) : undefined}
            </div>

            {isShared ? (
                <Alert>
                    <AlertTitle>{t("git.sharedBranchTitle")}</AlertTitle>
                    <AlertDescription>
                        {t("git.sharedBranchBody", { branch: branchName })}
                    </AlertDescription>
                </Alert>
            ) : (
                <>
                    <section className="flex flex-col gap-2">
                        <p className="flex items-center gap-1.5 text-ui font-medium">
                            <GitPullRequest aria-hidden className="size-3.5" />
                            {t("git.pullRequests")}
                        </p>

                        {prsLoading ? (
                            <div className="flex items-center gap-2 text-ui text-muted-foreground">
                                <Spinner className="size-3.5" />
                                {t("git.loading")}
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
                                                            PR_STATE_CLASS[
                                                                state
                                                            ],
                                                        )}
                                                        variant="outline"
                                                    >
                                                        #{pr.number} ·{" "}
                                                        {t(`prState.${state}`)}
                                                    </Badge>
                                                    {pr.draft && (
                                                        <Badge
                                                            className="shrink-0 text-meta"
                                                            variant="outline"
                                                        >
                                                            {t("git.draft")}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="line-clamp-2 text-ui">
                                                    {pr.title}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    onClick={() =>
                                                        setDiffPr(pr)
                                                    }
                                                    size="xs"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {t("git.viewDiff")}
                                                </Button>
                                                <Button
                                                    aria-label={t(
                                                        "git.openOnGitHub",
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

                    <section className="flex flex-col gap-2">
                        <p className="flex items-center gap-1.5 text-ui font-medium">
                            <GitCommit aria-hidden className="size-3.5" />
                            {t("git.commits")}
                        </p>

                        {commitsLoading ? (
                            <div className="flex items-center gap-2 text-ui text-muted-foreground">
                                <Spinner className="size-3.5" />
                                {t("git.loading")}
                            </div>
                        ) : commits.length === 0 ? (
                            <p className="text-ui text-muted-foreground">
                                {t("git.noCommits")}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-1.5">
                                {commits.map((commit) => (
                                    <li key={commit.sha}>
                                        <a
                                            className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
                                            href={commit.url}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            <span className="mt-0.5 shrink-0 font-mono text-meta text-muted-foreground group-hover:text-primary">
                                                {commit.sha.slice(0, 7)}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-ui">
                                                {commit.message}
                                            </span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            )}

            {diffPr && (
                <PrDiffDialog
                    onClose={() => setDiffPr(undefined)}
                    open
                    prNumber={diffPr.number}
                    prTitle={diffPr.title}
                    repoFullName={repoFullName}
                    token={token}
                />
            )}
        </div>
    );
}
