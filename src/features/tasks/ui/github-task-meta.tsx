import { GitBranch, GitPullRequest } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { TaskPullRequest } from "@/features/tasks/model/types";

import { formatBranchName } from "@/features/tasks/lib/format-branch";
import { cn } from "@/shared/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/shadcn/ui/tooltip";

const PR_STATE_CLASS: Record<TaskPullRequest["state"], string> = {
    closed: "text-red-500 hover:text-red-400",
    merged: "text-purple-500 hover:text-purple-400",
    open: "text-emerald-500 hover:text-emerald-400",
};

type GithubTaskMetaProperties = {
    branchName?: string;
    pr?: TaskPullRequest;
};

export function GithubTaskMeta({ branchName, pr }: GithubTaskMetaProperties) {
    const { t } = useTranslation("board");

    if (!branchName && !pr) {
        return;
    }

    return (
        <TooltipProvider delay={200}>
            <div className="flex min-w-0 items-center justify-end gap-2">
                {branchName ? (
                    <Tooltip>
                        <TooltipTrigger
                            className="inline-flex min-w-0 max-w-[9.5rem] cursor-default items-center gap-1 text-code text-muted-foreground"
                            render={<span />}
                        >
                            <GitBranch aria-hidden className="size-3 shrink-0" />
                            <span className="truncate">
                                {formatBranchName(branchName)}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{branchName}</TooltipContent>
                    </Tooltip>
                ) : undefined}

                {pr ? (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <a
                                    aria-label={t("prLink", {
                                        number: pr.number,
                                        state: t(`prState.${pr.state}`),
                                    })}
                                    className={cn(
                                        "inline-flex shrink-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        PR_STATE_CLASS[pr.state],
                                    )}
                                    href={pr.url}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                    }}
                                    onPointerDown={(event) => {
                                        event.stopPropagation();
                                    }}
                                    rel="noreferrer"
                                    target="_blank"
                                />
                            }
                        >
                            <GitPullRequest aria-hidden className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            {t("prTooltip", {
                                number: pr.number,
                                state: t(`prState.${pr.state}`),
                            })}
                        </TooltipContent>
                    </Tooltip>
                ) : undefined}
            </div>
        </TooltipProvider>
    );
}
