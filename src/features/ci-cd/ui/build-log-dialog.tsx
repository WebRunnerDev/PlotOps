import {
    CircleCheck,
    CircleX,
    ExternalLink,
    LoaderCircle,
    Timer,
} from "lucide-react";
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

export function BuildLogDialog({
    build,
    githubRepoId,
    onClose,
    open,
    projectId,
}: BuildLogDialogProperties) {
    const { t } = useTranslation("board");
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

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}
            open={open}
        >
            <DialogContent
                className={cn(
                    "flex h-[min(90vh,44rem)] w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-none border-l-2 sm:max-w-3xl",
                    "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:p-3",
                    build?.status === "success" && "border-l-emerald-500",
                    build?.status === "failure" && "border-l-red-500",
                    build?.status === "running" && "border-l-amber-400",
                    build?.status === "queued" && "border-l-border"
                )}
            >
                <DialogHeader className="shrink-0">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:pr-6">
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-h3 wrap-break-word">
                                {build
                                    ? t("cicd.logs.title", {
                                          branch: build.branch,
                                          workflow: build.workflowName,
                                      })
                                    : t("cicd.logs.titleFallback")}
                            </DialogTitle>
                            <DialogDescription className="font-mono text-meta text-muted-foreground wrap-break-word">
                                {build
                                    ? `${build.commitSha} · ${build.commitMessage}`
                                    : t("cicd.logs.hint")}
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

                <section
                    aria-label={t("cicd.logs.jobsLabel")}
                    className="shrink-0 space-y-2"
                >
                    <p className="text-meta uppercase tracking-wide text-muted-foreground">
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
                                    className="flex min-w-0 flex-col gap-2 border border-border px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
                                    key={job.id}
                                >
                                    <span className="min-w-0 text-ui wrap-break-word">
                                        {job.name}
                                    </span>
                                    <Badge
                                        className={cn(
                                            "w-fit gap-1 border font-mono text-meta uppercase tracking-wide",
                                            buildStatusAccentClass(job.status)
                                        )}
                                        variant="outline"
                                    >
                                        <JobStatusIcon status={job.status} />
                                        {t(`cicd.status.${job.status}`)}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <div className="scrollbar-board min-h-0 flex-1 overflow-y-auto rounded-none border border-border bg-background">
                    <pre
                        aria-live="polite"
                        className={cn(
                            "m-0 min-h-full whitespace-pre-wrap break-all p-3 font-mono text-meta text-foreground sm:text-code",
                            "selection:bg-primary/30"
                        )}
                    >
                        {lines.map((line) => (
                            <span className="block" key={line.index}>
                                {line.text}
                            </span>
                        ))}
                        {isStreaming ? (
                            <span
                                aria-hidden
                                className="inline-block animate-pulse text-emerald-400"
                            >
                                ▌
                            </span>
                        ) : undefined}
                        {!isStreaming && lines.length === 0 ? (
                            <span className="text-muted-foreground">
                                {t("cicd.logs.empty")}
                            </span>
                        ) : undefined}
                    </pre>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-meta uppercase tracking-wide text-muted-foreground">
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
