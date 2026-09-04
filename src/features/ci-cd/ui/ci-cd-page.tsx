import { Link } from "@tanstack/react-router";
import {
    CircleCheck,
    CircleX,
    GitBranch,
    LoaderCircle,
    Timer,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { BuildStatus, ProjectBuild } from "@/features/ci-cd/model/types";

import { useAuth } from "@/features/auth";
import {
    CiCdMissingTokenError,
    CiCdUnauthorizedError,
} from "@/features/ci-cd/api/github-actions-builds";
import { canFetchProjectBuilds } from "@/features/ci-cd/lib/can-fetch-project-builds";
import { buildStatusAccentClass } from "@/features/ci-cd/model/build-status";
import { useProjectBuilds } from "@/features/ci-cd/model/use-project-builds";
import { BuildLogDialog } from "@/features/ci-cd/ui/build-log-dialog";
import { BuildsLoadMoreSentinel } from "@/features/ci-cd/ui/builds-load-more-sentinel";
import { CiCdLoading } from "@/features/ci-cd/ui/ci-cd-loading";
import { isGuest } from "@/features/guest-mode";
import {
    projectHasGithubRepo,
    resolveProjectConnectHash,
} from "@/features/projects/model/project-github-gate";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type CiCdPageProperties = {
    projectId: string;
};

type RunFilter = "all" | "failure" | "running";

const STATUS_BORDER: Record<BuildStatus, string> = {
    failure: "border-l-red-500",
    queued: "border-l-border",
    running: "border-l-amber-400",
    success: "border-l-emerald-500",
};

const STATUS_WORD: Record<BuildStatus, string> = {
    failure: "text-red-400",
    queued: "text-muted-foreground",
    running: "text-amber-300",
    success: "text-emerald-400",
};

export function CiCdPage({ projectId }: CiCdPageProperties) {
    const { i18n, t } = useTranslation("board");
    const { githubAccessToken } = useAuth();
    const guest = isGuest();
    const {
        canView,
        isLoading: accessLoading,
        isSettled,
    } = useProjectAccess(projectId);
    const { data: project, isLoading: projectLoading } = useProject(projectId);
    const hasGithubRepo = projectHasGithubRepo(project?.github_repo_id);
    const canFetchBuilds = canFetchProjectBuilds({
        githubAccessToken,
        githubRepoId: project?.github_repo_id,
        isGuest: guest,
        projectId,
    });
    const {
        builds,
        error: buildsError,
        fetchNextPage,
        hasNextPage,
        isFetching: buildsFetching,
        isFetchingNextPage,
        isLoading: buildsLoading,
    } = useProjectBuilds(projectId, project?.github_repo_id);
    const [selectedBuild, setSelectedBuild] = useState<
        ProjectBuild | undefined
    >();
    const [filter, setFilter] = useState<RunFilter>("all");

    const summary = useMemo(() => {
        const defaultBranch = project?.github_default_branch ?? "main";
        const onDefault = builds.find(
            (build) => build.branch === defaultBranch
        );
        const failed = builds.filter(
            (build) => build.status === "failure"
        ).length;
        const running = builds.filter((build) =>
            isInFlight(build.status)
        ).length;
        return { defaultBranch, failed, onDefault, running };
    }, [builds, project?.github_default_branch]);

    const signalBuild = useMemo(
        () => pickSignalBuild(builds, summary.defaultBranch),
        [builds, summary.defaultBranch]
    );

    const filteredBuilds = useMemo(() => {
        if (filter === "all") return builds;
        if (filter === "failure") {
            return builds.filter((build) => build.status === "failure");
        }
        return builds.filter((build) => isInFlight(build.status));
    }, [builds, filter]);

    const listedBuilds = useMemo(() => {
        if (!signalBuild) return filteredBuilds;
        return filteredBuilds.filter((build) => build.id !== signalBuild.id);
    }, [filteredBuilds, signalBuild]);

    const { historyBuilds, liveBuilds } = useMemo(() => {
        const live: ProjectBuild[] = [];
        const history: ProjectBuild[] = [];
        for (const build of listedBuilds) {
            if (isInFlight(build.status)) live.push(build);
            else history.push(build);
        }
        return { historyBuilds: history, liveBuilds: live };
    }, [listedBuilds]);

    const filterCounts = useMemo(
        () => ({
            all: builds.length,
            failure: builds.filter((build) => build.status === "failure")
                .length,
            running: builds.filter((build) => isInFlight(build.status)).length,
        }),
        [builds]
    );

    const isBootstrapping = projectLoading || accessLoading;
    const isBuildsPending = canFetchBuilds && buildsLoading;
    const repoLabel = project?.github_full_name ?? project?.name;

    if (isBootstrapping || isBuildsPending) {
        return <CiCdLoading />;
    }

    if (!project || (isSettled && !canView)) {
        return (
            <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col gap-4 px-4 py-8">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const needsGitHubToken = hasGithubRepo && !canFetchBuilds;
    const tokenError =
        !guest &&
        (buildsError instanceof CiCdMissingTokenError ||
            buildsError instanceof CiCdUnauthorizedError);

    return (
        <div className="scrollbar-board relative mx-auto flex h-full w-full min-w-0 max-w-5xl flex-col gap-8 overflow-y-auto px-4 py-8 sm:gap-10 sm:py-10">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-80 bg-auth-atmosphere opacity-90 sm:-top-10 sm:h-112"
            />

            <header className="relative flex min-w-0 flex-col gap-5 motion-reveal sm:gap-6">
                <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
                    <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                        <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                            {t("cicd.eyebrow")}
                        </p>
                        {buildsFetching &&
                        !buildsLoading &&
                        !isFetchingNextPage ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-meta text-muted-foreground uppercase tracking-[0.12em]">
                                <span className="size-1.5 bg-primary motion-safe:animate-pulse" />
                                {t("cicd.refreshing")}
                            </span>
                        ) : undefined}
                    </div>

                    <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-1 leading-none tracking-[-0.045em]">
                        <span className="font-heading text-[clamp(2.5rem,1rem+5vw,4.25rem)] font-bold text-foreground">
                            CI
                        </span>
                        <span className="font-heading text-[clamp(2.5rem,1rem+5vw,4.25rem)] font-bold text-muted-foreground/30">
                            /CD
                        </span>
                    </h1>

                    <div aria-hidden className="h-px w-14 bg-primary/70" />

                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                        {repoLabel ? (
                            <p className="flex min-w-0 items-center gap-2 font-mono text-code text-muted-foreground">
                                <GitBranch
                                    aria-hidden
                                    className="size-3.5 shrink-0 text-primary/80"
                                />
                                <span className="min-w-0 truncate">
                                    {repoLabel}
                                </span>
                            </p>
                        ) : (
                            <span />
                        )}
                        <p className="max-w-md text-body text-muted-foreground sm:text-right">
                            {t("cicd.description")}
                        </p>
                    </div>
                </div>
            </header>

            {hasGithubRepo ? undefined : (
                <Alert className="relative motion-reveal [animation-delay:80ms]">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">{t("cicd.connectRepo")}</span>
                        <Button
                            className="shrink-0 self-start sm:self-auto"
                            nativeButton={false}
                            render={
                                <Link
                                    hash={resolveProjectConnectHash()}
                                    params={{ projectId }}
                                    to="/projects/$projectId/settings"
                                />
                            }
                            size="sm"
                            variant="outline"
                        >
                            {t("cicd.connectRepoAction")}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {hasGithubRepo && (needsGitHubToken || tokenError) ? (
                <Alert className="relative motion-reveal [animation-delay:80ms]">
                    <AlertDescription>{t("cicd.needsToken")}</AlertDescription>
                </Alert>
            ) : undefined}

            {canFetchBuilds && buildsError && !tokenError ? (
                <Alert
                    className="relative motion-reveal [animation-delay:80ms]"
                    variant="destructive"
                >
                    <AlertDescription>{t("cicd.loadFailed")}</AlertDescription>
                </Alert>
            ) : undefined}

            {canFetchBuilds && !buildsError ? (
                <>
                    {signalBuild ? (
                        <LiveSignal
                            build={signalBuild}
                            defaultBranch={summary.defaultBranch}
                            locale={i18n.language}
                            onOpen={() => {
                                setSelectedBuild(signalBuild);
                            }}
                            openLabel={t("cicd.openLogs", {
                                branch: signalBuild.branch,
                            })}
                            signalLabel={
                                isInFlight(signalBuild.status)
                                    ? t("cicd.signal.live")
                                    : t("cicd.signal.branch", {
                                          branch: summary.defaultBranch,
                                      })
                            }
                            statusLabel={t(`cicd.status.${signalBuild.status}`)}
                        />
                    ) : undefined}

                    <section
                        aria-label={t("cicd.summary.label")}
                        className="relative motion-reveal grid grid-cols-1 gap-px border border-border bg-border [animation-delay:140ms] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                        <SummaryCell
                            label={t("cicd.summary.defaultBranch", {
                                branch: summary.defaultBranch,
                            })}
                            monoLabel
                        >
                            {summary.onDefault ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <StatusPulse
                                        status={summary.onDefault.status}
                                    />
                                    <BuildStatusBadge
                                        build={summary.onDefault}
                                        label={t(
                                            `cicd.status.${summary.onDefault.status}`
                                        )}
                                    />
                                </div>
                            ) : (
                                <span className="font-mono text-ui text-muted-foreground">
                                    {t("cicd.summary.noDefaultRun")}
                                </span>
                            )}
                        </SummaryCell>
                        <SummaryCell label={t("cicd.summary.failed")}>
                            <span
                                className={cn(
                                    "font-heading text-[clamp(2rem,1rem+2.5vw,2.75rem)] font-bold leading-none tracking-[-0.045em] tabular-nums",
                                    summary.failed > 0
                                        ? "text-red-400"
                                        : "text-muted-foreground/40"
                                )}
                            >
                                {String(summary.failed).padStart(2, "0")}
                            </span>
                        </SummaryCell>
                        <SummaryCell label={t("cicd.summary.running")}>
                            <span
                                className={cn(
                                    "font-heading text-[clamp(2rem,1rem+2.5vw,2.75rem)] font-bold leading-none tracking-[-0.045em] tabular-nums",
                                    summary.running > 0
                                        ? "text-amber-300 cicd-status-breathe"
                                        : "text-muted-foreground/40"
                                )}
                            >
                                {String(summary.running).padStart(2, "0")}
                            </span>
                        </SummaryCell>
                    </section>

                    <div
                        aria-label={t("cicd.filters.label")}
                        className="relative motion-reveal flex flex-wrap gap-1 border border-border bg-card/40 p-1 [animation-delay:180ms]"
                        role="group"
                    >
                        {(
                            [
                                ["all", t("cicd.filters.all")],
                                ["failure", t("cicd.filters.failed")],
                                ["running", t("cicd.filters.running")],
                            ] as const
                        ).map(([value, label]) => {
                            const active = filter === value;
                            const count = filterCounts[value];
                            return (
                                <button
                                    aria-pressed={active}
                                    className={cn(
                                        "flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2.5 font-mono text-meta uppercase tracking-[0.12em] transition-[color,background-color,box-shadow] duration-300 ease-(--ease-out-expo)",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        active
                                            ? "bg-background text-foreground shadow-[inset_0_-2px_0_0_var(--primary)]"
                                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                    )}
                                    key={value}
                                    onClick={() => {
                                        setFilter(value);
                                    }}
                                    type="button"
                                >
                                    <span>{label}</span>
                                    <span
                                        className={cn(
                                            "tabular-nums",
                                            active
                                                ? "text-primary"
                                                : "text-muted-foreground/60"
                                        )}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {filteredBuilds.length === 0 &&
                    !hasNextPage &&
                    !isFetchingNextPage ? (
                        <EmptyRuns
                            filtered={builds.length > 0}
                            idleLabel={t("cicd.emptyIdle")}
                            message={
                                builds.length === 0
                                    ? t("cicd.empty")
                                    : t("cicd.emptyFilter")
                            }
                            prompt={t("cicd.emptyPrompt")}
                            title={
                                builds.length === 0
                                    ? t("cicd.emptyTitle")
                                    : t("cicd.emptyFilterTitle")
                            }
                            workflowsLabel={t("cicd.emptyWorkflows")}
                        />
                    ) : (
                        <>
                            {liveBuilds.length > 0 ||
                            historyBuilds.length > 0 ? (
                                <>
                                    {liveBuilds.length > 0 ? (
                                        <RunSection
                                            builds={liveBuilds}
                                            locale={i18n.language}
                                            onSelect={setSelectedBuild}
                                            openLogsLabel={(branch) =>
                                                t("cicd.openLogs", { branch })
                                            }
                                            startDelayMs={200}
                                            statusLabel={(status) =>
                                                t(`cicd.status.${status}`)
                                            }
                                            title={t("cicd.sections.live")}
                                        />
                                    ) : undefined}

                                    {historyBuilds.length > 0 ? (
                                        <RunSection
                                            builds={historyBuilds}
                                            locale={i18n.language}
                                            onSelect={setSelectedBuild}
                                            openLogsLabel={(branch) =>
                                                t("cicd.openLogs", { branch })
                                            }
                                            startDelayMs={
                                                liveBuilds.length > 0
                                                    ? 280
                                                    : 200
                                            }
                                            statusLabel={(status) =>
                                                t(`cicd.status.${status}`)
                                            }
                                            title={t("cicd.sections.history")}
                                        />
                                    ) : undefined}
                                </>
                            ) : signalBuild &&
                              filteredBuilds.length === 1 ? undefined : (
                                <EmptyRuns
                                    filtered={builds.length > 0}
                                    idleLabel={t("cicd.emptyIdle")}
                                    message={t("cicd.emptyFilter")}
                                    prompt={t("cicd.emptyPrompt")}
                                    title={t("cicd.emptyFilterTitle")}
                                    workflowsLabel={t("cicd.emptyWorkflows")}
                                />
                            )}

                            {hasNextPage || isFetchingNextPage ? (
                                <div className="relative flex flex-col items-center gap-2 py-4">
                                    <BuildsLoadMoreSentinel
                                        enabled={
                                            hasNextPage && !isFetchingNextPage
                                        }
                                        onVisible={() => {
                                            void fetchNextPage();
                                        }}
                                    />
                                    {isFetchingNextPage ? (
                                        <div className="flex items-center gap-2 font-mono text-meta text-muted-foreground uppercase tracking-[0.12em]">
                                            <Spinner className="size-4" />
                                            <span>{t("cicd.loadingMore")}</span>
                                        </div>
                                    ) : undefined}
                                </div>
                            ) : undefined}
                        </>
                    )}
                </>
            ) : undefined}

            <BuildLogDialog
                build={selectedBuild}
                githubRepoId={project.github_repo_id}
                onClose={() => {
                    setSelectedBuild(undefined);
                }}
                open={selectedBuild !== undefined}
                projectId={projectId}
            />
        </div>
    );
}

function BuildRow({
    build,
    locale,
    onSelect,
    openLabel,
    statusLabel,
}: {
    build: ProjectBuild;
    locale: string;
    onSelect: () => void;
    openLabel: string;
    statusLabel: string;
}) {
    return (
        <button
            aria-label={openLabel}
            className={cn(
                "group flex w-full cursor-pointer flex-col gap-2 border-l-2 bg-card/25 px-3 py-3.5 text-left transition-[background-color,transform] duration-300 ease-(--ease-out-expo)",
                "hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hover:translate-x-0.5",
                STATUS_BORDER[build.status],
                isInFlight(build.status) && "bg-amber-500/5"
            )}
            onClick={onSelect}
            type="button"
        >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                    <span className="min-w-0 text-ui font-medium wrap-break-word">
                        {build.workflowName}
                    </span>
                    <span className="inline-flex w-fit max-w-full items-center gap-1.5 border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono text-code text-muted-foreground">
                        <GitBranch
                            aria-hidden
                            className="size-3 shrink-0 text-primary/70 transition-transform duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5"
                        />
                        <span className="min-w-0 truncate">{build.branch}</span>
                    </span>
                </div>
                <BuildStatusBadge build={build} label={statusLabel} />
            </div>
            <p className="line-clamp-2 min-w-0 text-ui leading-snug text-muted-foreground">
                {build.commitMessage}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-meta text-muted-foreground/75">
                <span className="shrink-0">{build.commitSha}</span>
                <span className="shrink-0">
                    {formatRelativeOrAbsolute(
                        build.finishedAt ?? build.startedAt,
                        locale
                    )}
                </span>
                {build.summary && build.status === "failure" ? (
                    <span className="min-w-0 truncate text-red-400/90">
                        {build.summary}
                    </span>
                ) : undefined}
            </div>
        </button>
    );
}

function BuildStatusBadge({
    build,
    label,
}: {
    build: ProjectBuild;
    label: string;
}) {
    return (
        <Badge
            className={cn(
                "h-auto gap-1 border font-mono text-meta uppercase tracking-wide",
                buildStatusAccentClass(build.status)
            )}
            variant="outline"
        >
            <StatusIcon status={build.status} />
            {label}
        </Badge>
    );
}

function EmptyRuns({
    filtered,
    idleLabel,
    message,
    prompt,
    title,
    workflowsLabel,
}: {
    filtered: boolean;
    idleLabel: string;
    message: string;
    prompt: string;
    title: string;
    workflowsLabel: string;
}) {
    return (
        <div className="relative motion-reveal overflow-hidden border border-dashed border-border bg-card/30 [animation-delay:220ms]">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-auth-atmosphere opacity-50"
            />
            <div className="relative flex items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
                <span className="font-mono text-code text-primary">
                    {workflowsLabel}
                </span>
                <span
                    className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 font-mono text-meta uppercase tracking-[0.12em]",
                        filtered ? "text-amber-300" : "text-muted-foreground"
                    )}
                >
                    <span
                        className={cn(
                            "size-1.5",
                            filtered
                                ? "bg-amber-400 motion-safe:animate-pulse"
                                : "bg-muted-foreground/60"
                        )}
                    />
                    {idleLabel}
                </span>
            </div>
            <div className="relative flex flex-col gap-2 px-4 py-12 text-center sm:px-6">
                <p className="font-heading text-[clamp(1.5rem,1rem+1.5vw,2rem)] font-bold tracking-[-0.03em] text-foreground">
                    {title}
                </p>
                <p className="mx-auto max-w-md text-body text-muted-foreground">
                    {message}
                </p>
            </div>
            <div className="relative border-t border-border px-3 py-2 font-mono text-meta text-muted-foreground sm:px-4">
                <span className="text-primary/80">$</span> {prompt}
                <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-primary/80 motion-safe:animate-pulse" />
            </div>
        </div>
    );
}

function formatRelativeOrAbsolute(
    iso: string | undefined,
    locale: string
): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";

    const deltaMs = date.getTime() - Date.now();
    const absSeconds = Math.abs(deltaMs) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (absSeconds < 60) {
        return rtf.format(Math.round(deltaMs / 1000), "second");
    }
    if (absSeconds < 3600) {
        return rtf.format(Math.round(deltaMs / 60_000), "minute");
    }
    if (absSeconds < 86_400) {
        return rtf.format(Math.round(deltaMs / 3_600_000), "hour");
    }
    if (absSeconds < 86_400 * 7) {
        return rtf.format(Math.round(deltaMs / 86_400_000), "day");
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function isInFlight(status: BuildStatus): boolean {
    return status === "running" || status === "queued";
}

function LiveSignal({
    build,
    defaultBranch,
    locale,
    onOpen,
    openLabel,
    signalLabel,
    statusLabel,
}: {
    build: ProjectBuild;
    defaultBranch: string;
    locale: string;
    onOpen: () => void;
    openLabel: string;
    signalLabel: string;
    statusLabel: string;
}) {
    const live = isInFlight(build.status);
    const onDefault = build.branch === defaultBranch;

    return (
        <button
            aria-label={openLabel}
            className={cn(
                "group relative motion-reveal flex w-full cursor-pointer flex-col overflow-hidden border border-border border-l-2 bg-card/50 text-left backdrop-blur-sm transition-[border-color,background-color] duration-300 ease-(--ease-out-expo) [animation-delay:100ms]",
                "hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                STATUS_BORDER[build.status],
                live && "cicd-live-scan",
                !live &&
                    build.status === "failure" &&
                    "cicd-live-scan cicd-live-scan-failure"
            )}
            onClick={onOpen}
            type="button"
        >
            <div className="relative grid min-w-0 gap-5 p-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-8 sm:p-6">
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                        {signalLabel}
                    </p>
                    <p
                        className={cn(
                            "font-heading text-[clamp(1.75rem,0.8rem+3vw,2.75rem)] font-bold leading-none tracking-[-0.04em] uppercase",
                            STATUS_WORD[build.status],
                            live && "cicd-status-breathe"
                        )}
                    >
                        {statusLabel}
                    </p>
                </div>

                <div className="flex min-w-0 flex-col justify-center gap-2.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 text-h3 wrap-break-word text-foreground">
                            {build.workflowName}
                        </span>
                        {onDefault ? (
                            <span className="shrink-0 border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-meta text-primary uppercase tracking-[0.1em]">
                                {defaultBranch}
                            </span>
                        ) : undefined}
                    </div>
                    <span className="inline-flex w-fit max-w-full items-center gap-1.5 border border-border/80 bg-background/70 px-1.5 py-0.5 font-mono text-code text-muted-foreground">
                        <GitBranch
                            aria-hidden
                            className="size-3 shrink-0 text-primary/70 transition-transform duration-300 ease-(--ease-out-expo) group-hover:translate-x-0.5"
                        />
                        <span className="min-w-0 truncate">{build.branch}</span>
                    </span>
                    <p className="line-clamp-2 max-w-xl text-ui text-muted-foreground">
                        {build.commitMessage}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-meta text-muted-foreground/75">
                        <span>{build.commitSha}</span>
                        <span>
                            {formatRelativeOrAbsolute(
                                build.finishedAt ?? build.startedAt,
                                locale
                            )}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}

/** Most important run for the Live Signal — in-flight first, else default branch. */
function pickSignalBuild(
    builds: ProjectBuild[],
    defaultBranch: string
): ProjectBuild | undefined {
    const live = builds.find((build) => isInFlight(build.status));
    if (live) return live;
    const onDefault = builds.find((build) => build.branch === defaultBranch);
    if (onDefault) return onDefault;
    return builds[0];
}

function RunSection({
    builds,
    locale,
    onSelect,
    openLogsLabel,
    startDelayMs,
    statusLabel,
    title,
}: {
    builds: ProjectBuild[];
    locale: string;
    onSelect: (build: ProjectBuild) => void;
    openLogsLabel: (branch: string) => string;
    startDelayMs: number;
    statusLabel: (status: BuildStatus) => string;
    title: string;
}) {
    return (
        <section className="relative flex min-w-0 flex-col gap-3">
            <div className="motion-reveal flex min-w-0 items-baseline justify-between gap-3">
                <h2 className="font-mono text-meta text-muted-foreground uppercase tracking-[0.14em]">
                    {title}
                </h2>
                <span className="font-mono text-meta text-muted-foreground/50 tabular-nums">
                    {String(builds.length).padStart(2, "0")}
                </span>
            </div>
            <ul className="divide-y divide-border border border-border">
                {builds.map((build, index) => (
                    <li
                        className="motion-reveal"
                        key={build.id}
                        style={{
                            animationDelay: `${startDelayMs + Math.min(index, 8) * 40}ms`,
                        }}
                    >
                        <BuildRow
                            build={build}
                            locale={locale}
                            onSelect={() => {
                                onSelect(build);
                            }}
                            openLabel={openLogsLabel(build.branch)}
                            statusLabel={statusLabel(build.status)}
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function StatusIcon({ status }: { status: BuildStatus }) {
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

function StatusPulse({ status }: { status: BuildStatus }) {
    return (
        <span
            aria-hidden
            className={cn(
                "size-2 shrink-0",
                status === "success" && "bg-emerald-400",
                status === "failure" && "bg-red-500",
                status === "running" && "bg-amber-400 cicd-status-breathe",
                status === "queued" && "bg-muted-foreground/50"
            )}
        />
    );
}

function SummaryCell({
    children,
    label,
    monoLabel = false,
}: {
    children: ReactNode;
    label: string;
    monoLabel?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-2.5 bg-card/60 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
            <p
                className={cn(
                    "text-meta uppercase tracking-[0.12em] text-muted-foreground",
                    monoLabel && "font-mono tracking-[0.08em] normal-case"
                )}
            >
                {label}
            </p>
            {children}
        </div>
    );
}
