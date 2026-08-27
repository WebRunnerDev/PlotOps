import { Link } from "@tanstack/react-router";
import { CircleCheck, CircleX, LoaderCircle, Timer } from "lucide-react";
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
        const running = builds.filter(
            (build) => build.status === "running" || build.status === "queued"
        ).length;
        return { defaultBranch, failed, onDefault, running };
    }, [builds, project?.github_default_branch]);

    const filteredBuilds = useMemo(() => {
        if (filter === "all") return builds;
        if (filter === "failure") {
            return builds.filter((build) => build.status === "failure");
        }
        return builds.filter(
            (build) => build.status === "running" || build.status === "queued"
        );
    }, [builds, filter]);

    const isBootstrapping = projectLoading || accessLoading;
    const isBuildsPending = canFetchBuilds && buildsLoading;

    if (isBootstrapping || isBuildsPending) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (!project || (isSettled && !canView)) {
        return (
            <div className="flex flex-col gap-4 p-4">
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
        <div className="scrollbar-board mx-auto flex h-full w-full min-w-0 max-w-5xl flex-col gap-4 overflow-y-auto px-4 py-4">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h1 className="truncate text-h1">{t("cicd.title")}</h1>
                        <span className="truncate font-mono text-meta text-muted-foreground">
                            {project.github_full_name ?? project.name}
                        </span>
                    </div>
                    {buildsFetching && !buildsLoading && !isFetchingNextPage ? (
                        <span className="text-meta uppercase tracking-wide text-muted-foreground">
                            {t("cicd.refreshing")}
                        </span>
                    ) : undefined}
                </div>
                <p className="max-w-2xl text-body text-muted-foreground">
                    {t("cicd.description")}
                </p>
            </header>

            {hasGithubRepo ? undefined : (
                <Alert>
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
                <Alert>
                    <AlertDescription>{t("cicd.needsToken")}</AlertDescription>
                </Alert>
            ) : undefined}

            {canFetchBuilds && buildsError && !tokenError ? (
                <Alert variant="destructive">
                    <AlertDescription>{t("cicd.loadFailed")}</AlertDescription>
                </Alert>
            ) : undefined}

            {canFetchBuilds && !buildsError ? (
                <>
                    <section
                        aria-label={t("cicd.summary.label")}
                        className="grid grid-cols-1 gap-3 border border-border p-3 sm:grid-cols-3"
                    >
                        <SummaryCell
                            label={t("cicd.summary.defaultBranch", {
                                branch: summary.defaultBranch,
                            })}
                        >
                            {summary.onDefault ? (
                                <BuildStatusBadge
                                    build={summary.onDefault}
                                    label={t(
                                        `cicd.status.${summary.onDefault.status}`
                                    )}
                                />
                            ) : (
                                <span className="text-ui text-muted-foreground">
                                    {t("cicd.summary.noDefaultRun")}
                                </span>
                            )}
                        </SummaryCell>
                        <SummaryCell label={t("cicd.summary.failed")}>
                            <span
                                className={cn(
                                    "font-mono text-h3",
                                    summary.failed > 0
                                        ? "text-red-400"
                                        : "text-muted-foreground"
                                )}
                            >
                                {summary.failed}
                            </span>
                        </SummaryCell>
                        <SummaryCell label={t("cicd.summary.running")}>
                            <span
                                className={cn(
                                    "font-mono text-h3",
                                    summary.running > 0
                                        ? "text-amber-300"
                                        : "text-muted-foreground"
                                )}
                            >
                                {summary.running}
                            </span>
                        </SummaryCell>
                    </section>

                    <div
                        aria-label={t("cicd.filters.label")}
                        className="flex flex-wrap gap-2"
                        role="group"
                    >
                        {(
                            [
                                ["all", t("cicd.filters.all")],
                                ["failure", t("cicd.filters.failed")],
                                ["running", t("cicd.filters.running")],
                            ] as const
                        ).map(([value, label]) => (
                            <Button
                                aria-pressed={filter === value}
                                key={value}
                                onClick={() => {
                                    setFilter(value);
                                }}
                                size="sm"
                                variant={
                                    filter === value ? "default" : "outline"
                                }
                            >
                                {label}
                            </Button>
                        ))}
                    </div>

                    {filteredBuilds.length === 0 &&
                    !hasNextPage &&
                    !isFetchingNextPage ? (
                        <p className="py-8 text-center text-ui text-muted-foreground">
                            {builds.length === 0
                                ? t("cicd.empty")
                                : t("cicd.emptyFilter")}
                        </p>
                    ) : (
                        <>
                            {filteredBuilds.length > 0 ? (
                                <ul className="divide-y divide-border border border-border">
                                    {filteredBuilds.map((build) => {
                                        const statusLabel = t(
                                            `cicd.status.${build.status}`
                                        );

                                        return (
                                            <li key={build.id}>
                                                <button
                                                    aria-label={t(
                                                        "cicd.openLogs",
                                                        {
                                                            branch: build.branch,
                                                        }
                                                    )}
                                                    className={cn(
                                                        "flex w-full cursor-pointer flex-col gap-1 border-l-2 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                        build.status ===
                                                            "success" &&
                                                            "border-l-emerald-500",
                                                        build.status ===
                                                            "failure" &&
                                                            "border-l-red-500",
                                                        build.status ===
                                                            "running" &&
                                                            "border-l-amber-400",
                                                        build.status ===
                                                            "queued" &&
                                                            "border-l-border"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedBuild(build);
                                                    }}
                                                    type="button"
                                                >
                                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                                            <span className="min-w-0 text-ui font-medium wrap-break-word">
                                                                {
                                                                    build.workflowName
                                                                }
                                                            </span>
                                                            <span className="font-mono text-code text-muted-foreground">
                                                                {build.branch}
                                                            </span>
                                                        </div>
                                                        <BuildStatusBadge
                                                            build={build}
                                                            label={statusLabel}
                                                        />
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-0.5">
                                                        <span className="min-w-0 text-ui text-muted-foreground wrap-break-word">
                                                            {
                                                                build.commitMessage
                                                            }
                                                        </span>
                                                        <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                                            {build.commitSha}
                                                        </span>
                                                        <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                                            {formatRelativeOrAbsolute(
                                                                build.finishedAt ??
                                                                    build.startedAt,
                                                                i18n.language
                                                            )}
                                                        </span>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : undefined}

                            {hasNextPage || isFetchingNextPage ? (
                                <div className="flex flex-col items-center gap-2 py-3">
                                    <BuildsLoadMoreSentinel
                                        enabled={
                                            hasNextPage && !isFetchingNextPage
                                        }
                                        onVisible={() => {
                                            void fetchNextPage();
                                        }}
                                    />
                                    {isFetchingNextPage ? (
                                        <div className="flex items-center gap-2 text-meta text-muted-foreground">
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

function SummaryCell({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1.5">
            <p className="text-meta uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}
