import { Link } from "@tanstack/react-router";
import {
    ArrowLeft,
    CircleCheck,
    CircleX,
    LoaderCircle,
    Timer,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { BuildStatus, ProjectBuild } from "@/features/ci-cd/model/types";

import { buildStatusAccentClass } from "@/features/ci-cd/model/build-status";
import { useProjectBuilds } from "@/features/ci-cd/model/use-project-builds";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProject } from "@/features/projects/model/use-projects";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/shadcn/ui/alert";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/shadcn/ui/table";

type CiCdPageProperties = {
    projectId: string;
};

export function CiCdPage({ projectId }: CiCdPageProperties) {
    const { i18n, t } = useTranslation("board");
    const { canView, isLoading: accessLoading } = useProjectAccess(projectId);
    const {
        data: project,
        error: projectError,
        isLoading: projectLoading,
    } = useProject(projectId);
    const {
        data: builds = [],
        error: buildsError,
        isLoading: buildsLoading,
    } = useProjectBuilds(projectId);

    const isLoading = projectLoading || accessLoading || buildsLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <Spinner className="size-8 text-primary" />
            </div>
        );
    }

    if (projectError || !project || !canView) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <Alert variant="destructive">
                    <AlertDescription>{t("projectError")}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 overflow-y-auto px-4 py-4">
            <header className="flex flex-col gap-3 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                            className="shrink-0 text-muted-foreground"
                            nativeButton={false}
                            render={
                                <Link
                                    params={{ projectId }}
                                    to="/projects/$projectId"
                                />
                            }
                            size="sm"
                            variant="ghost"
                        >
                            <ArrowLeft data-icon="inline-start" />
                            {t("cicd.backToBoard")}
                        </Button>
                        <h1 className="truncate text-h1">{t("cicd.title")}</h1>
                        <span className="truncate font-mono text-meta text-muted-foreground">
                            {project.name}
                        </span>
                    </div>
                    <p className="text-meta uppercase tracking-wide text-muted-foreground">
                        {t("cicd.mockHint")}
                    </p>
                </div>
                <p className="max-w-2xl text-body text-muted-foreground">
                    {t("cicd.description")}
                </p>
            </header>

            {buildsError ? (
                <Alert variant="destructive">
                    <AlertDescription>{t("cicd.loadFailed")}</AlertDescription>
                </Alert>
            ) : null}

            {builds.length === 0 ? (
                <p className="py-8 text-center text-ui text-muted-foreground">
                    {t("cicd.empty")}
                </p>
            ) : (
                <div className="overflow-hidden rounded-none border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="text-meta uppercase tracking-wide">
                                    {t("cicd.columns.branch")}
                                </TableHead>
                                <TableHead className="text-meta uppercase tracking-wide">
                                    {t("cicd.columns.status")}
                                </TableHead>
                                <TableHead className="hidden text-meta uppercase tracking-wide sm:table-cell">
                                    {t("cicd.columns.commit")}
                                </TableHead>
                                <TableHead className="hidden text-meta uppercase tracking-wide md:table-cell">
                                    {t("cicd.columns.finished")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {builds.map((build) => {
                                const statusLabel = t(
                                    `cicd.status.${build.status}`
                                );
                                const summary =
                                    build.status === "failure" && build.summary
                                        ? t("cicd.failedOn", {
                                              reason: t(
                                                  `cicd.failureReason.${build.summary}`,
                                                  {
                                                      defaultValue:
                                                          build.summary,
                                                  }
                                              ),
                                          })
                                        : undefined;

                                return (
                                    <TableRow
                                        className={cn(
                                            "border-l-2",
                                            build.status === "success" &&
                                                "border-l-emerald-500",
                                            build.status === "failure" &&
                                                "border-l-red-500",
                                            build.status === "running" &&
                                                "border-l-amber-400",
                                            build.status === "queued" &&
                                                "border-l-border"
                                        )}
                                        key={build.id}
                                    >
                                        <TableCell>
                                            <span className="font-mono text-code">
                                                {build.branch}
                                            </span>
                                            {summary ? (
                                                <p className="mt-0.5 text-meta text-red-400">
                                                    {summary}
                                                </p>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            <BuildStatusBadge
                                                build={build}
                                                label={statusLabel}
                                            />
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="flex min-w-0 flex-col gap-0.5">
                                                <span className="truncate text-ui">
                                                    {build.commitMessage}
                                                </span>
                                                <span className="font-mono text-meta text-muted-foreground">
                                                    {build.commitSha}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden font-mono text-meta text-muted-foreground md:table-cell">
                                            {formatBuildTimestamp(
                                                build.finishedAt ??
                                                    build.startedAt,
                                                i18n.language
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
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
                "gap-1 border font-mono text-meta uppercase tracking-wide",
                buildStatusAccentClass(build.status)
            )}
            variant="outline"
        >
            <StatusIcon status={build.status} />
            {label}
        </Badge>
    );
}

function formatBuildTimestamp(iso: string | undefined, locale: string): string {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
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
