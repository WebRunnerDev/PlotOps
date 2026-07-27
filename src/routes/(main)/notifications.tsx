import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatNotificationContext } from "@/features/notifications/lib/format-notification-context";
import {
    useMarkAllNotificationsRead,
    useNotificationsList,
    useNotificationsRealtime,
} from "@/features/notifications/model/use-notifications";
import { useOpenNotification } from "@/features/notifications/model/use-open-notification";
import { useProjects } from "@/features/projects";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type NotificationsSearch = {
    limit?: number;
    offset?: number;
    projectId?: string;
    q?: string;
};

const DEFAULT_PAGE_SIZE = 30;

export const Route = createFileRoute("/(main)/notifications")({
    component: NotificationsPage,
    validateSearch: (search: Record<string, unknown>): NotificationsSearch => ({
        limit: parseOptionalPositiveInt(search.limit),
        offset: parseOptionalNonNegativeInt(search.offset) ?? 0,
        projectId:
            typeof search.projectId === "string" ? search.projectId : undefined,
        q: typeof search.q === "string" ? search.q : undefined,
    }),
});

function NotificationsPage() {
    const { t } = useTranslation("common");
    const navigate = Route.useNavigate();
    const search = Route.useSearch();
    const openNotification = useOpenNotification();

    useNotificationsRealtime();

    const markAll = useMarkAllNotificationsRead();
    const { data: projects = [] } = useProjects();

    const pageSize = search.limit ?? DEFAULT_PAGE_SIZE;
    const [qDraft, setQDraft] = useState(search.q ?? "");

    useEffect(() => {
        setQDraft(search.q ?? "");
    }, [search.q]);

    const listQuery = useNotificationsList({
        cleanupFirst: true,
        limit: pageSize,
        offset: search.offset ?? 0,
        projectId: search.projectId,
        q: search.q,
    });

    const projectNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const project of projects) {
            map.set(project.id, project.name);
        }
        return map;
    }, [projects]);

    function updateSearch(patch: Partial<NotificationsSearch>) {
        void navigate({
            search: {
                ...search,
                ...patch,
            },
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-2 border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-h1">{t("nav.notifications")}</h1>
                    <Button
                        disabled={markAll.isPending}
                        onClick={() => {
                            void markAll.mutateAsync({
                                projectId: search.projectId,
                            });
                        }}
                        size="sm"
                        variant="outline"
                    >
                        {t("notifications.markAllRead")}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t("notifications.pageDescription")}
                </p>
            </header>

            <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                    className="sm:max-w-sm"
                    onChange={(event) => setQDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            updateSearch({
                                offset: 0,
                                q: qDraft.trim() || undefined,
                            });
                        }
                    }}
                    placeholder={t("notifications.searchPlaceholder")}
                    value={qDraft}
                />
                <Select
                    onValueChange={(value) => {
                        if (typeof value !== "string") return;
                        updateSearch({
                            offset: 0,
                            projectId: value === "__all__" ? undefined : value,
                        });
                    }}
                    value={search.projectId ?? "__all__"}
                >
                    <SelectTrigger className="sm:w-56">
                        <span>
                            {search.projectId
                                ? (projectNameById.get(search.projectId) ??
                                  search.projectId)
                                : t("notifications.allProjects")}
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">
                            {t("notifications.allProjects")}
                        </SelectItem>
                        {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                                {project.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    onClick={() => {
                        updateSearch({
                            offset: 0,
                            q: qDraft.trim() || undefined,
                        });
                    }}
                    size="sm"
                >
                    {t("notifications.search")}
                </Button>
            </div>

            {listQuery.isLoading ? (
                <div className="flex justify-center py-16">
                    <Spinner className="size-8 text-primary" />
                </div>
            ) : (listQuery.data?.length ?? 0) === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                    {t("nav.notificationsEmpty")}
                </p>
            ) : (
                <ul className="divide-y divide-border border border-border">
                    {(listQuery.data ?? []).map((item) => (
                        <li key={item.id}>
                            <button
                                className={cn(
                                    "flex w-full flex-col gap-1 px-3 py-3 text-left hover:bg-muted/40",
                                    item.readAt ? "opacity-70" : "bg-muted/20"
                                )}
                                onClick={() => {
                                    void openNotification(item);
                                }}
                                type="button"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-meta text-muted-foreground">
                                        {item.taskKey}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {projectNameById.get(item.projectId) ??
                                            item.projectId}
                                    </span>
                                </div>
                                <span className="truncate text-sm font-medium">
                                    {item.taskTitle}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatNotificationContext(item, t)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex items-center justify-between gap-2">
                <Button
                    disabled={(search.offset ?? 0) <= 0}
                    onClick={() => {
                        updateSearch({
                            offset: Math.max(
                                0,
                                (search.offset ?? 0) - pageSize
                            ),
                        });
                    }}
                    size="sm"
                    variant="outline"
                >
                    {t("notifications.prev")}
                </Button>
                <Button
                    disabled={(listQuery.data?.length ?? 0) < pageSize}
                    onClick={() => {
                        updateSearch({
                            offset: (search.offset ?? 0) + pageSize,
                        });
                    }}
                    size="sm"
                    variant="outline"
                >
                    {t("notifications.next")}
                </Button>
            </div>

            <p className="text-xs text-muted-foreground">
                <Link className="underline underline-offset-2" to="/home">
                    {t("nav.home")}
                </Link>
            </p>
        </div>
    );
}

function parseOptionalNonNegativeInt(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return Math.floor(parsed);
        }
    }
    return undefined;
}

function parseOptionalPositiveInt(value: unknown): number | undefined {
    const parsed = parseOptionalNonNegativeInt(value);
    return parsed !== undefined && parsed > 0 ? parsed : undefined;
}
