import {
    CircleCheck,
    CircleX,
    ExternalLink,
    LoaderCircle,
    Minus,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
    GitCheckRollup,
    GitCheckRun,
} from "@/features/git-integration/api/github-git-api";

import { isGitHubApiError } from "@/features/git-integration/api/github-git-api";
import { canFetchPullRequestChecks } from "@/features/git-integration/lib/can-fetch-git-data";
import { usePullRequestChecks } from "@/features/git-integration/model/use-git-data";
import { isGuest } from "@/features/guest-mode";
import { cn } from "@/shared/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type PrChecksSummaryProperties = {
    githubToken: null | string;
    prNumber: number;
    repoFullName: string | undefined;
};

export function PrChecksSummary({
    githubToken,
    prNumber,
    repoFullName,
}: PrChecksSummaryProperties) {
    const { t } = useTranslation("board");
    const guest = isGuest();
    const enabled = canFetchPullRequestChecks({
        isGuest: guest,
        prNumber,
        repoFullName,
        token: githubToken,
    });

    const { data, error, isError, isPending } = usePullRequestChecks(
        repoFullName,
        prNumber,
        githubToken
    );

    if (!enabled) return;

    if (isPending) {
        return (
            <div className="flex items-center gap-2 text-meta text-muted-foreground">
                <Spinner className="size-3.5" />
                <span>{t("github.checks.loading")}</span>
            </div>
        );
    }

    if (isError) {
        return (
            <p className="text-meta text-muted-foreground">
                {checksErrorMessage(error, t)}
            </p>
        );
    }

    if (!data) return;

    const countLabel = t("github.checks.count", { count: data.checks.length });

    return (
        <Collapsible className="min-w-0">
            <CollapsibleTrigger className="group flex w-full min-w-0 items-center gap-2 rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <RollupBadge rollup={data.rollup} />
                <span className="min-w-0 truncate text-meta text-muted-foreground">
                    {t(`github.checks.rollup.${data.rollup}`)}
                    {data.checks.length > 0 ? ` · ${countLabel}` : undefined}
                </span>
            </CollapsibleTrigger>
            {data.checks.length > 0 ? (
                <CollapsibleContent className="mt-1.5 flex flex-col gap-1 border-l border-border/60 pl-2.5">
                    {data.checks.map((check) => (
                        <CheckRow check={check} key={check.id} />
                    ))}
                    {data.truncated ? (
                        <p className="text-meta text-muted-foreground">
                            {t("github.checks.truncated")}
                        </p>
                    ) : undefined}
                </CollapsibleContent>
            ) : (
                <CollapsibleContent className="mt-1">
                    <p className="text-meta text-muted-foreground">
                        {t("github.checks.empty")}
                    </p>
                </CollapsibleContent>
            )}
        </Collapsible>
    );
}

function CheckRow({ check }: { check: GitCheckRun }) {
    const { t } = useTranslation("board");
    const href = check.detailsUrl ?? check.htmlUrl;
    const statusKey = checkStatusKey(check);

    return (
        <div className="flex min-w-0 items-center gap-1.5">
            <CheckStatusIcon statusKey={statusKey} />
            <span className="min-w-0 flex-1 truncate font-mono text-code text-foreground/90">
                {check.name}
            </span>
            <span className="shrink-0 text-meta text-muted-foreground">
                {t(`github.checks.status.${statusKey}`)}
            </span>
            {href ? (
                <a
                    aria-label={t("github.checks.openDetails", {
                        name: check.name,
                    })}
                    className="inline-flex shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href={href}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                    rel="noreferrer"
                    target="_blank"
                >
                    <ExternalLink aria-hidden className="size-3" />
                </a>
            ) : undefined}
        </div>
    );
}

function checksErrorMessage(
    error: unknown,
    t: (key: string) => string
): string {
    if (isGitHubApiError(error)) {
        if (error.status === 401 || error.status === 403) {
            return t("github.checks.authFailed");
        }
        if (error.status === 404) {
            return t("github.checks.notFound");
        }
        if (error.status === 429) {
            return t("github.checks.rateLimited");
        }
    }
    return t("github.checks.failed");
}

function CheckStatusIcon({
    statusKey,
}: {
    statusKey: "failure" | "neutral" | "pending" | "success";
}) {
    switch (statusKey) {
        case "failure": {
            return (
                <CircleX aria-hidden className="size-3 shrink-0 text-red-400" />
            );
        }
        case "pending": {
            return (
                <LoaderCircle
                    aria-hidden
                    className="size-3 shrink-0 animate-spin text-amber-300"
                />
            );
        }
        case "success": {
            return (
                <CircleCheck
                    aria-hidden
                    className="size-3 shrink-0 text-emerald-400"
                />
            );
        }
        default: {
            return (
                <Minus
                    aria-hidden
                    className="size-3 shrink-0 text-muted-foreground"
                />
            );
        }
    }
}

function checkStatusKey(
    check: GitCheckRun
): "failure" | "neutral" | "pending" | "success" {
    if (
        check.conclusion === "failure" ||
        check.conclusion === "timed_out" ||
        check.conclusion === "cancelled" ||
        check.conclusion === "action_required"
    ) {
        return "failure";
    }
    if (
        check.status === "queued" ||
        check.status === "in_progress" ||
        check.status === "pending" ||
        check.status === "requested" ||
        check.status === "waiting" ||
        check.conclusion == undefined
    ) {
        return "pending";
    }
    if (check.conclusion === "success" || check.conclusion === "skipped") {
        return "success";
    }
    return "neutral";
}

function rollupAccentClass(rollup: GitCheckRollup): string {
    switch (rollup) {
        case "failure": {
            return "border-red-500/50 bg-red-500/10 text-red-400";
        }
        case "pending": {
            return "border-amber-500/40 bg-amber-500/10 text-amber-300";
        }
        case "success": {
            return "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
        }
        default: {
            return "border-border bg-muted/40 text-muted-foreground";
        }
    }
}

function RollupBadge({ rollup }: { rollup: GitCheckRollup }) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-meta",
                rollupAccentClass(rollup)
            )}
        >
            <RollupIcon rollup={rollup} />
        </span>
    );
}

function RollupIcon({ rollup }: { rollup: GitCheckRollup }) {
    switch (rollup) {
        case "failure": {
            return <CircleX aria-hidden className="size-3" />;
        }
        case "pending": {
            return <LoaderCircle aria-hidden className="size-3 animate-spin" />;
        }
        case "success": {
            return <CircleCheck aria-hidden className="size-3" />;
        }
        default: {
            return <Minus aria-hidden className="size-3" />;
        }
    }
}
