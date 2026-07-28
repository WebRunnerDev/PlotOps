import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

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

type NotificationsSearch = {
    limit?: number;
    offset?: number;
    projectId?: string;
    q?: string;
    returnBoardId?: string;
    returnProjectId?: string;
};

const DEFAULT_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/(main)/notifications")({
    component: NotificationsPage,
    validateSearch: (search: Record<string, unknown>): NotificationsSearch => ({
        limit: parseOptionalPositiveInt(search.limit),
        offset: parseOptionalNonNegativeInt(search.offset) ?? 0,
        projectId:
            typeof search.projectId === "string" ? search.projectId : undefined,
        q: typeof search.q === "string" ? search.q : undefined,
        returnBoardId:
            typeof search.returnBoardId === "string"
                ? search.returnBoardId
                : undefined,
        returnProjectId:
            typeof search.returnProjectId === "string"
                ? search.returnProjectId
                : undefined,
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

    const returnProjectId = search.returnProjectId;
    const returnBoardId = search.returnBoardId;
    const canReturnToBoard =
        returnProjectId !== undefined && returnBoardId !== undefined;

    useEffect(() => {
        setQDraft(search.q ?? "");
    }, [search.q]);

    useEffect(() => {
        const nextQ = qDraft.trim() || undefined;
        if (nextQ === search.q) {
            return;
        }
        const timeoutId = globalThis.setTimeout(() => {
            void navigate({
                search: {
                    ...search,
                    offset: 0,
                    q: nextQ,
                },
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            globalThis.clearTimeout(timeoutId);
        };
    }, [navigate, qDraft, search]);

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
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {canReturnToBoard ? (
                            <Button
                                className="shrink-0 text-muted-foreground"
                                nativeButton={false}
                                render={
                                    <Link
                                        params={{
                                            boardId: returnBoardId,
                                            projectId: returnProjectId,
                                        }}
                                        to="/projects/$projectId/boards/$boardId"
                                    />
                                }
                                size="sm"
                                variant="ghost"
                            >
                                <ArrowLeft data-icon="inline-start" />
                                {t("notifications.backToBoard")}
                            </Button>
                        ) : (
                            <Button
                                className="shrink-0 text-muted-foreground"
                                nativeButton={false}
                                render={<Link to="/home" />}
                                size="sm"
                                variant="ghost"
                            >
                                <ArrowLeft data-icon="inline-start" />
                                {t("notifications.backToProjects")}
                            </Button>
                        )}
                        <h1 className="truncate text-h1">
                            {t("nav.notifications")}
                        </h1>
                    </div>
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
                    type="search"
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
            </div>

            {listQuery.isLoading ? (
                <ul
                    aria-busy="true"
                    aria-live="polite"
                    className="divide-y divide-border border border-border"
                    role="status"
                >
                    {Array.from({ length: 8 }, (_, index) => (
                        <li
                            aria-hidden
                            className="flex flex-col gap-1 px-3 py-3 leading-none"
                            key={index}
                        >
                            <div className="flex items-center gap-2">
                                <Skeleton
                                    containerClassName="block leading-none"
                                    height={12}
                                    width={72}
                                />
                                <Skeleton
                                    containerClassName="block leading-none"
                                    height={12}
                                    width={96}
                                />
                            </div>
                            <Skeleton
                                containerClassName="block leading-none"
                                height={14}
                                width="70%"
                            />
                            <Skeleton
                                containerClassName="block leading-none"
                                height={12}
                                width="40%"
                            />
                        </li>
                    ))}
                </ul>
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
                                <span className="text-sm font-medium">
                                    {formatNotificationContext(item, t)}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {item.taskTitle}
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
