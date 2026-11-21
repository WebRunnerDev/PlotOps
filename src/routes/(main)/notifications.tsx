import { createFileRoute, Link } from "@tanstack/react-router";
import {
    ArrowLeft,
    BellOff,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Search,
    SearchX,
    XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

import {
    useMarkAllNotificationsRead,
    useNotificationsList,
    useNotificationsRealtime,
    useUnreadNotificationsCount,
} from "@/features/notifications/model/use-notifications";
import { useOpenNotification } from "@/features/notifications/model/use-open-notification";
import { NotificationList } from "@/features/notifications/ui/notification-list";
import { useProjects } from "@/features/projects";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
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
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);

    useNotificationsRealtime();

    const markAll = useMarkAllNotificationsRead();
    const { data: projects = [] } = useProjects();
    const { data: unreadCount = 0 } = useUnreadNotificationsCount({
        projectId: search.projectId,
    });

    const pageSize = search.limit ?? DEFAULT_PAGE_SIZE;
    const offset = search.offset ?? 0;
    const [qDraft, setQDraft] = useState(search.q ?? "");

    const returnProjectId = search.returnProjectId;
    const returnBoardId = search.returnBoardId;
    const canReturnToBoard =
        returnProjectId !== undefined && returnBoardId !== undefined;
    const hasFilters = Boolean(search.q) || search.projectId !== undefined;

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
        offset,
        projectId: search.projectId,
        q: search.q,
    });
    const items = listQuery.data ?? [];
    const hasNextPage = items.length >= pageSize;
    const showPagination = offset > 0 || hasNextPage;

    const projectNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const project of projects) {
            map.set(project.id, project.name);
        }
        return map;
    }, [projects]);
    const showProjectNames =
        search.projectId === undefined && projects.length > 1;

    function updateSearch(patch: Partial<NotificationsSearch>) {
        void navigate({
            search: {
                ...search,
                ...patch,
            },
        });
    }

    function clearFilters() {
        setQDraft("");
        updateSearch({ offset: 0, projectId: undefined, q: undefined });
    }

    return (
        <div className="flex flex-col gap-4 px-4 py-8">
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
                        <span
                            className="font-mono text-meta text-muted-foreground"
                            data-testid="notifications-unread-summary"
                        >
                            {unreadCount > 0
                                ? t("notifications.unreadCount", {
                                      count: unreadCount,
                                  })
                                : t("notifications.allCaughtUp")}
                        </span>
                    </div>
                    <Button
                        data-testid="notifications-mark-all-read"
                        disabled={markAll.isPending || unreadCount === 0}
                        onClick={() => {
                            markAll.mutate(
                                { projectId: search.projectId },
                                {
                                    onError: () => {
                                        toast.error(
                                            t("notifications.updateFailed")
                                        );
                                    },
                                    onSuccess: () => {
                                        toast.success(
                                            t("notifications.markedAllRead")
                                        );
                                    },
                                }
                            );
                        }}
                        size="sm"
                        variant="outline"
                    >
                        <CheckCheck data-icon="inline-start" />
                        {search.projectId
                            ? t("notifications.markAllReadInProject")
                            : t("notifications.markAllRead")}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t("notifications.pageDescription")}
                </p>
            </header>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative sm:w-full sm:max-w-sm">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        aria-label={t("notifications.search")}
                        className="pl-8"
                        data-testid="notifications-search"
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
                </div>
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
                    <SelectTrigger
                        aria-label={t("notifications.projectFilter")}
                        className="sm:w-56"
                    >
                        <span className="truncate">
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
                {hasFilters ? (
                    <Button
                        className="self-start text-muted-foreground sm:self-auto"
                        onClick={clearFilters}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <XIcon data-icon="inline-start" />
                        {t("notifications.clearFilters")}
                    </Button>
                ) : undefined}
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
                            className="flex gap-3 px-3 py-3 leading-none"
                            key={index}
                        >
                            <Skeleton height={28} width={28} />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <Skeleton
                                    containerClassName="block leading-none"
                                    height={14}
                                    width="60%"
                                />
                                <Skeleton
                                    containerClassName="block leading-none"
                                    height={12}
                                    width="40%"
                                />
                                <Skeleton
                                    containerClassName="block leading-none"
                                    height={10}
                                    width="20%"
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            ) : listQuery.isError ? (
                <div className="flex flex-col items-center gap-3 py-10">
                    <p className="text-center text-sm text-destructive">
                        {t("notifications.loadFailed")}
                    </p>
                    <Button
                        onClick={() => void listQuery.refetch()}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {t("notifications.retry")}
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 border border-dashed border-border px-6 py-12 text-center">
                    {hasFilters ? (
                        <>
                            <SearchX
                                aria-hidden
                                className="size-6 text-muted-foreground"
                            />
                            <p className="text-sm font-medium">
                                {t("notifications.noMatches")}
                            </p>
                            <Button
                                onClick={clearFilters}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {t("notifications.clearFilters")}
                            </Button>
                        </>
                    ) : (
                        <>
                            <BellOff
                                aria-hidden
                                className="size-6 text-muted-foreground"
                            />
                            <p className="text-sm font-medium">
                                {t("notifications.emptyTitle")}
                            </p>
                            <p className="max-w-sm text-xs text-muted-foreground">
                                {t("notifications.emptyHint")}
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <NotificationList
                    activeTaskId={selectedTaskId}
                    className="border border-border"
                    items={items}
                    onOpen={(item) => {
                        void openNotification(item);
                    }}
                    projectNameFor={
                        showProjectNames
                            ? (item) => projectNameById.get(item.projectId)
                            : undefined
                    }
                />
            )}

            {showPagination ? (
                <nav
                    aria-label={t("notifications.pagination")}
                    className="flex items-center justify-between gap-2"
                >
                    <Button
                        disabled={offset <= 0}
                        onClick={() => {
                            updateSearch({
                                offset: Math.max(0, offset - pageSize),
                            });
                        }}
                        size="sm"
                        variant="outline"
                    >
                        <ChevronLeft data-icon="inline-start" />
                        {t("notifications.prev")}
                    </Button>
                    <span className="font-mono text-meta text-muted-foreground">
                        {t("notifications.pageNumber", {
                            page: Math.floor(offset / pageSize) + 1,
                        })}
                    </span>
                    <Button
                        disabled={!hasNextPage}
                        onClick={() => {
                            updateSearch({
                                offset: offset + pageSize,
                            });
                        }}
                        size="sm"
                        variant="outline"
                    >
                        {t("notifications.next")}
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </nav>
            ) : undefined}
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
