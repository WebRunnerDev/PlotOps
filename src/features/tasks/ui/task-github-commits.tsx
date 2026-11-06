import { formatDistanceToNowStrict } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { ChevronRight, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTaskCommits } from "@/features/git-integration/model/use-git-data";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";
import { Spinner } from "@/shared/shadcn/ui/spinner";

export type TaskCommitsRepository = {
    /** Linked branch; undefined for none or a shared branch. */
    branchName: string | undefined;
    fullName: string;
    id: string;
};

type TaskGithubCommitsProperties = {
    canEdit: boolean;
    githubToken: null | string;
    linkedCommitSha: string | undefined;
    onUnlinkCommit: () => void;
    repositories: readonly TaskCommitsRepository[];
    /** Several Repositories in the Project: show the Repository column. */
    showRepository: boolean;
    taskKey: string;
};

/**
 * Commits section of the drawer GitHub block: every commit of the Task
 * across its Repositories (smart commits by key, branch commits, the linked
 * commit). Empty → a one-line hint about the Task key instead.
 */
export function TaskGithubCommits({
    canEdit,
    githubToken,
    linkedCommitSha,
    onUnlinkCommit,
    repositories,
    showRepository,
    taskKey,
}: TaskGithubCommitsProperties) {
    const { i18n, t } = useTranslation("board");
    const { commits, isError, isLoading, refetch } = useTaskCommits({
        linkedCommitSha,
        repositories,
        taskKey,
        token: githubToken,
    });

    const linkedListed = commits.some((row) => row.linked);
    // The linked commit could not be loaded (no GitHub token): still show it.
    const rows: Array<{
        date: null | string;
        linked: boolean;
        message: string;
        repository: string | undefined;
        sha: string;
        url: string | undefined;
    }> = [
        ...(linkedCommitSha && !linkedListed && !isLoading
            ? [
                  {
                      date: null,
                      linked: true,
                      message: "",
                      repository: undefined,
                      sha: linkedCommitSha,
                      url: undefined,
                  },
              ]
            : []),
        ...commits.map((row) => ({
            date: row.commit.author.date,
            linked: row.linked,
            message: row.commit.message.split("\n")[0] ?? "",
            repository: row.repository.fullName,
            sha: row.commit.sha,
            url: row.commit.url,
        })),
    ];

    if (isLoading && rows.length === 0) {
        return (
            <div className="flex items-center gap-2 border-t border-primary/15 pt-3 text-ui text-muted-foreground">
                <Spinner className="size-3.5" />
                {t("github.commitsLoading")}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-between gap-2 border-t border-primary/15 pt-3">
                <p className="min-w-0 text-ui text-muted-foreground">
                    {isError
                        ? t("git.loadFailed")
                        : t("github.commitsEmpty", { key: taskKey })}
                </p>
                {isError ? (
                    <Button
                        onClick={refetch}
                        size="xs"
                        type="button"
                        variant="outline"
                    >
                        {t("git.retry")}
                    </Button>
                ) : undefined}
            </div>
        );
    }

    const dateLocale = i18n.language.toLowerCase().startsWith("ru") ? ru : enUS;

    return (
        <Collapsible
            className="flex flex-col gap-2 border-t border-primary/15 pt-3"
            defaultOpen
        >
            <div className="flex items-center justify-between gap-2">
                <CollapsibleTrigger className="group flex min-w-0 items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90"
                    />
                    <span className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                        {t("github.commitsTitle", { count: rows.length })}
                    </span>
                </CollapsibleTrigger>
                <Button
                    aria-label={t("git.refresh")}
                    onClick={refetch}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    {isLoading ? (
                        <Spinner className="size-3.5" />
                    ) : (
                        <RefreshCw className="size-3.5" />
                    )}
                </Button>
            </div>
            <CollapsibleContent>
                <ul
                    aria-label={t("github.commitsTitle", {
                        count: rows.length,
                    })}
                    className="flex flex-col"
                >
                    {rows.map((row) => (
                        <li
                            className="flex min-w-0 items-center gap-2 py-1"
                            key={row.sha}
                        >
                            {row.url ? (
                                <a
                                    className="shrink-0 rounded-sm font-mono text-code text-muted-foreground underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                    href={row.url}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    {row.sha.slice(0, 7)}
                                </a>
                            ) : (
                                <span className="shrink-0 font-mono text-code text-muted-foreground">
                                    {row.sha.slice(0, 7)}
                                </span>
                            )}
                            <span
                                className={cn(
                                    "min-w-0 flex-1 truncate text-ui",
                                    !row.message && "text-muted-foreground"
                                )}
                                title={row.message || undefined}
                            >
                                {row.message || t("github.commitLinked")}
                            </span>
                            {showRepository && row.repository ? (
                                <span
                                    className="max-w-24 shrink-0 truncate font-mono text-meta text-muted-foreground"
                                    title={row.repository}
                                >
                                    {repositoryShortName(row.repository)}
                                </span>
                            ) : undefined}
                            {row.date ? (
                                <time
                                    className="shrink-0 text-meta text-muted-foreground"
                                    dateTime={row.date}
                                    title={new Date(row.date).toLocaleString(
                                        i18n.language
                                    )}
                                >
                                    {formatDistanceToNowStrict(
                                        new Date(row.date),
                                        { locale: dateLocale }
                                    )}
                                </time>
                            ) : undefined}
                            {row.linked && canEdit ? (
                                <Button
                                    aria-label={t("github.unlinkCommit")}
                                    className="shrink-0"
                                    onClick={onUnlinkCommit}
                                    size="icon-xs"
                                    title={t("github.unlinkCommit")}
                                    type="button"
                                    variant="ghost"
                                >
                                    <X className="size-3.5" />
                                </Button>
                            ) : undefined}
                        </li>
                    ))}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

/** `owner/name` → `name` for the narrow Repository column. */
function repositoryShortName(fullName: string) {
    return fullName.split("/").at(-1) ?? fullName;
}
