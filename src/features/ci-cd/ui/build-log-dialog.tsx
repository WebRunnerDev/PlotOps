import {
    Check,
    CircleCheck,
    CircleX,
    Copy,
    Download,
    ExternalLink,
    GitBranch,
    LoaderCircle,
    Maximize2,
    Minimize2,
    Timer,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type {
    BuildsRepository,
    BuildStatus,
    ProjectBuild,
} from "@/features/ci-cd/model/types";

import { buildStatusAccentClass } from "@/features/ci-cd/model/build-status";
import { pickDefaultJob } from "@/features/ci-cd/model/default-job";
import {
    jobLogFileName,
    jobLogText,
} from "@/features/ci-cd/model/job-log-export";
import { useBuildJobs } from "@/features/ci-cd/model/use-build-jobs";
import { useJobLogStream } from "@/features/ci-cd/model/use-job-log-stream";
import { JobLogConsole } from "@/features/ci-cd/ui/job-log-console";
import { cn } from "@/shared/lib/utils";
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
    onClose: () => void;
    open: boolean;
    projectId: string;
    /** The Repository the run belongs to — jobs and logs are read there. */
    repository: BuildsRepository | undefined;
    /** Name the Repository in the header (Project has several). */
    showRepository?: boolean;
};

const STATUS_BORDER: Record<BuildStatus, string> = {
    failure: "border-l-red-500",
    queued: "border-l-border",
    running: "border-l-amber-400",
    success: "border-l-emerald-500",
};

export function BuildLogDialog({
    build,
    onClose,
    open,
    projectId,
    repository,
    showRepository = false,
}: BuildLogDialogProperties) {
    const { t } = useTranslation("board");
    const {
        data: jobs = build?.jobs ?? [],
        isError: jobsError,
        isLoading: jobsLoading,
        refetch: refetchJobs,
    } = useBuildJobs(
        projectId,
        repository,
        build?.id,
        open && Boolean(build),
        build?.status
    );
    // The pick is tied to its run, so opening another run starts on its default.
    const [picked, setPicked] = useState<{ buildId: string; jobId: string }>();
    const selectedJob =
        (picked && picked.buildId === build?.id
            ? jobs.find((job) => job.id === picked.jobId)
            : undefined) ?? pickDefaultJob(jobs);
    const { isLive, isLoading, lines } = useJobLogStream(
        repository,
        open && build ? selectedJob : undefined
    );

    const [copied, setCopied] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const canExport = Boolean(build && selectedJob) && lines.length > 0;

    const handleCopyLog = async () => {
        try {
            await navigator.clipboard.writeText(jobLogText(lines));
            setCopied(true);
            toast.success(t("cicd.logs.copied"));
            globalThis.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error(t("copyFailed"));
        }
    };

    const handleDownloadLog = () => {
        if (!build || !selectedJob) return;
        const url = URL.createObjectURL(
            new Blob([jobLogText(lines)], { type: "text/plain;charset=utf-8" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = jobLogFileName(build, selectedJob);
        link.click();
        globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
            open={open}
        >
            <DialogContent
                className={cn(
                    "flex w-full flex-col gap-0 overflow-hidden rounded-none border-l-2 p-0 transition-[width,height,max-width] duration-200 ease-(--ease-out-expo)",
                    maximized
                        ? "h-[calc(100dvh-2rem)] sm:max-w-[calc(100vw-2rem)]"
                        : "h-[min(92dvh,62rem)] sm:max-w-6xl",
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
                                        {showRepository ? (
                                            <span className="min-w-0 truncate text-primary/80">
                                                {build.repositoryName}
                                            </span>
                                        ) : undefined}
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
                            <ul className="scrollbar-board flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                                {jobs.map((job) => {
                                    const selected = job.id === selectedJob?.id;
                                    return (
                                        <li className="min-w-0" key={job.id}>
                                            <button
                                                aria-pressed={selected}
                                                className={cn(
                                                    "flex min-w-0 max-w-full items-center gap-1.5 border border-border border-l-2 px-2 py-1 text-left text-ui transition-colors",
                                                    "hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                                                    STATUS_BORDER[job.status],
                                                    selected
                                                        ? "bg-muted text-foreground"
                                                        : "bg-card/40 text-muted-foreground"
                                                )}
                                                onClick={() => {
                                                    if (build) {
                                                        setPicked({
                                                            buildId: build.id,
                                                            jobId: job.id,
                                                        });
                                                    }
                                                }}
                                                type="button"
                                            >
                                                <span
                                                    aria-hidden
                                                    className={cn(
                                                        buildStatusAccentClass(
                                                            job.status
                                                        ),
                                                        "inline-flex shrink-0 border-0 bg-transparent"
                                                    )}
                                                >
                                                    <JobStatusIcon
                                                        status={job.status}
                                                    />
                                                </span>
                                                <span className="min-w-0 truncate">
                                                    {job.name}
                                                </span>
                                                <span className="sr-only">
                                                    {t(
                                                        `cicd.status.${job.status}`
                                                    )}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <JobLogConsole
                        actions={
                            <>
                                <Button
                                    aria-label={t("cicd.logs.copy")}
                                    disabled={!canExport}
                                    onClick={() => void handleCopyLog()}
                                    size="icon-xs"
                                    title={t("cicd.logs.copy")}
                                    type="button"
                                    variant="ghost"
                                >
                                    {copied ? <Check /> : <Copy />}
                                </Button>
                                <Button
                                    aria-label={t("cicd.logs.download")}
                                    disabled={!canExport}
                                    onClick={handleDownloadLog}
                                    size="icon-xs"
                                    title={t("cicd.logs.download")}
                                    type="button"
                                    variant="ghost"
                                >
                                    <Download />
                                </Button>
                                <Button
                                    aria-label={t(
                                        maximized
                                            ? "cicd.logs.restore"
                                            : "cicd.logs.maximize"
                                    )}
                                    aria-pressed={maximized}
                                    className="max-sm:hidden"
                                    onClick={() =>
                                        setMaximized((value) => !value)
                                    }
                                    size="icon-xs"
                                    title={t(
                                        maximized
                                            ? "cicd.logs.restore"
                                            : "cicd.logs.maximize"
                                    )}
                                    type="button"
                                    variant="ghost"
                                >
                                    {maximized ? <Minimize2 /> : <Maximize2 />}
                                </Button>
                            </>
                        }
                        isLive={isLive}
                        isLoading={isLoading}
                        jobName={selectedJob?.name}
                        key={`${build?.id ?? ""}:${selectedJob?.id ?? ""}`}
                        lines={lines}
                        status={selectedJob?.status}
                    />
                </div>

                <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5 font-mono text-meta uppercase tracking-[0.12em] text-muted-foreground sm:px-5">
                    {isLoading ? (
                        <>
                            <Spinner className="size-3.5 text-primary" />
                            <span>
                                {t(
                                    isLive
                                        ? "cicd.logs.loadingLive"
                                        : "cicd.logs.loadingFull"
                                )}
                            </span>
                        </>
                    ) : isLive ? (
                        <>
                            <span className="size-1.5 bg-amber-400 cicd-status-breathe" />
                            <span>{t("cicd.logs.liveHint")}</span>
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
