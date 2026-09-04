import {
    CircleCheck,
    CircleX,
    ExternalLink,
    GitBranch,
    LoaderCircle,
    Timer,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { BuildStatus, ProjectBuild } from "@/features/ci-cd/model/types";

import { buildStatusAccentClass } from "@/features/ci-cd/model/build-status";
import { useBuildJobs } from "@/features/ci-cd/model/use-build-jobs";
import { useBuildLogStream } from "@/features/ci-cd/model/use-build-log-stream";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type BuildLogDialogProperties = {
    build: ProjectBuild | undefined;
    githubRepoId: null | number | undefined;
    onClose: () => void;
    open: boolean;
    projectId: string;
};

const STATUS_BORDER: Record<BuildStatus, string> = {
    failure: "border-l-red-500",
    queued: "border-l-border",
    running: "border-l-amber-400",
    success: "border-l-emerald-500",
};

export function BuildLogDialog({
    build,
    githubRepoId,
    onClose,
    open,
    projectId,
}: BuildLogDialogProperties) {
    const { t } = useTranslation("board");
    const endReference = useRef<HTMLSpanElement>(null);
    const { isStreaming, lines } = useBuildLogStream(
        projectId,
        open && build ? build.id : undefined,
        build?.status
    );
    const {
        data: jobs = build?.jobs ?? [],
        isError: jobsError,
        isLoading: jobsLoading,
        refetch: refetchJobs,
    } = useBuildJobs(
        projectId,
        build?.id,
        open && Boolean(build),
        githubRepoId
    );

    useEffect(() => {
        if (!open || lines.length === 0) return;
        endReference.current?.scrollIntoView({
            behavior: "auto",
            block: "end",
        });
    }, [lines.length, open]);

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
            open={open}
        >
            <DialogContent
                className={cn(
                    "flex h-[min(90vh,44rem)] w-full max-w-3xl flex-col gap-0 overflow-hidden rounded-none border-l-2 p-0 sm:max-w-3xl",
                    "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
                    build ? STATUS_BORDER[build.status] : "border-l-border"
                )}
            >
                <DialogHeader className="shrink-0 space-y-0 border-b border-border px-4 pt-4 pb-3 sm:px-5 sm:pr-12">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                            <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                                {t("cicd.logs.eyebrow")}
                            </p>
                            <DialogTitle className="text-h3 wrap-break-word text-balance">
                                {build
                                    ? t("cicd.logs.title", {
                                          branch: build.branch,
                                          workflow: build.workflowName,
                                      })
                                    : t("cicd.logs.titleFallback")}
                            </DialogTitle>
                            <div
                                aria-hidden
                                className="h-px w-10 bg-primary/60"
                            />
                            <DialogDescription className="flex min-w-0 flex-col gap-1.5 font-mono text-meta text-muted-foreground">
                                {build ? (
                                    <>
                                        <span className="inline-flex min-w-0 items-center gap-1.5 wrap-break-word">
                                            <GitBranch
                                                aria-hidden
                                                className="size-3 shrink-0 text-primary/70"
                                            />
                                            <span className="min-w-0 truncate">
                                                {build.branch}
                                            </span>
                                            <span className="text-border">
                                                ·
                                            </span>
                                            <span className="shrink-0">
                                                {build.commitSha}
                                            </span>
                                        </span>
                                        <span className="line-clamp-2 wrap-break-word font-sans text-ui text-muted-foreground">
                                            {build.commitMessage}
                                        </span>
                                    </>
                                ) : (
                                    t("cicd.logs.hint")
                                )}
                            </DialogDescription>
                        </div>
                        {build?.htmlUrl ? (
                            <Button
                                className="w-full shrink-0 sm:w-auto"
                                nativeButton={false}
                                render={
                                    <a
                                        href={build.htmlUrl}
                                        rel="noreferrer"
                                        target="_blank"
                                    />
                                }
                                size="sm"
                                variant="outline"
                            >
                                <ExternalLink data-icon="inline-start" />
                                {t("cicd.logs.openOnGitHub")}
                            </Button>
                        ) : undefined}
                    </div>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:px-5">
                    <section
                        aria-label={t("cicd.logs.jobsLabel")}
                        className="shrink-0 space-y-2"
                    >
                        <p className="font-mono text-meta uppercase tracking-[0.12em] text-muted-foreground">
                            {t("cicd.logs.jobsLabel")}
                        </p>
                        {jobsLoading && jobs.length === 0 ? (
                            <div className="flex justify-center py-2">
                                <Spinner className="size-4 text-muted-foreground" />
                            </div>
                        ) : jobsError && jobs.length === 0 ? (
                            <div className="flex flex-col gap-2">
                                <p className="text-ui text-destructive">
                                    {t("cicd.logs.jobsLoadFailed")}
                                </p>
                                <Button
                                    onClick={() => void refetchJobs()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {t("cicd.retry")}
                                </Button>
                            </div>
                        ) : jobs.length === 0 ? (
                            <p className="text-ui text-muted-foreground">
                                {t("cicd.logs.noJobs")}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-1.5">
                                {jobs.map((job) => (
                                    <li
                                        className={cn(
                                            "flex min-w-0 flex-col gap-2 border border-border border-l-2 bg-card/40 px-2.5 py-1.5 sm:flex-row sm:items-center sm:justify-between",
                                            STATUS_BORDER[job.status]
                                        )}
                                        key={job.id}
                                    >
                                        <span className="min-w-0 text-ui wrap-break-word">
                                            {job.name}
                                        </span>
                                        <Badge
                                            className={cn(
                                                "w-fit gap-1 border font-mono text-meta uppercase tracking-wide",
                                                buildStatusAccentClass(
                                                    job.status
                                                )
                                            )}
                                            variant="outline"
                                        >
                                            <JobStatusIcon
                                                status={job.status}
                                            />
                                            {t(`cicd.status.${job.status}`)}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background">
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                            <span className="font-mono text-meta text-muted-foreground uppercase tracking-[0.12em]">
                                {t("cicd.logs.console")}
                            </span>
                            <div className="flex items-center gap-3">
                                {lines.length > 0 ? (
                                    <span className="font-mono text-meta text-muted-foreground/60 tabular-nums">
                                        {String(lines.length).padStart(3, "0")}{" "}
                                        {t("cicd.logs.lines")}
                                    </span>
                                ) : undefined}
                                {isStreaming ? (
                                    <span className="inline-flex items-center gap-1.5 font-mono text-meta text-amber-300 uppercase tracking-[0.12em]">
                                        <span className="size-1.5 bg-amber-400 cicd-status-breathe" />
                                        {t("cicd.logs.streaming")}
                                    </span>
                                ) : undefined}
                            </div>
                        </div>
                        <div className="scrollbar-board min-h-0 flex-1 overflow-y-auto">
                            <pre
                                aria-live="polite"
                                className={cn(
                                    "m-0 min-h-full p-0 font-mono text-meta text-foreground sm:text-code",
                                    "selection:bg-primary/30"
                                )}
                            >
                                {lines.map((line) => (
                                    <span
                                        className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-0 border-b border-border/30"
                                        key={line.index}
                                    >
                                        <span
                                            aria-hidden
                                            className="select-none border-r border-border/40 px-2 py-0.5 text-right text-muted-foreground/45 tabular-nums"
                                        >
                                            {line.index + 1}
                                        </span>
                                        <span className="whitespace-pre-wrap break-all px-2.5 py-0.5">
                                            {line.text}
                                        </span>
                                    </span>
                                ))}
                                {isStreaming ? (
                                    <span
                                        aria-hidden
                                        className="grid grid-cols-[2.75rem_minmax(0,1fr)]"
                                    >
                                        <span className="border-r border-border/40" />
                                        <span className="inline-block animate-pulse px-2.5 text-emerald-400">
                                            ▌
                                        </span>
                                    </span>
                                ) : undefined}
                                {!isStreaming && lines.length === 0 ? (
                                    <span className="block px-3 py-3 text-muted-foreground">
                                        {t("cicd.logs.empty")}
                                    </span>
                                ) : undefined}
                                <span ref={endReference} />
                            </pre>
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5 font-mono text-meta uppercase tracking-[0.12em] text-muted-foreground sm:px-5">
                    {isStreaming ? (
                        <>
                            <Spinner
                                aria-label={t("cicd.logs.streaming")}
                                className="size-4 text-amber-400"
                            />
                            <span>{t("cicd.logs.streaming")}</span>
                        </>
                    ) : (
                        <span>{t("cicd.logs.hint")}</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function JobStatusIcon({ status }: { status: BuildStatus }) {
    switch (status) {
        case "failure": {
            return <CircleX aria-hidden className="size-3.5" />;
        }
        case "queued": {
            return <Timer aria-hidden className="size-3.5" />;
        }
        case "running": {
            return (
                <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            );
        }
        case "success": {
            return <CircleCheck aria-hidden className="size-3.5" />;
        }
    }
}
