import type { CSSProperties } from "react";

import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { TaskWatcher } from "@/features/notifications/model/types";

import {
    useTaskWatchers,
    useToggleTaskWatch,
} from "@/features/notifications/model/use-task-watchers";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/shadcn/ui/tooltip";

const MAX_VISIBLE_WATCHERS = 8;

export function TaskWatchersList(properties: {
    projectId: string;
    taskId: string;
}) {
    const { t } = useTranslation("board");
    const { data, isError, isLoading, refetch } = useTaskWatchers({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });
    const toggleWatch = useToggleTaskWatch({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });

    const watchers = data?.watchers ?? [];
    const isWatching = data?.isWatching ?? false;

    return (
        <section className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
                <Label className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                    {t("watchers.title")}
                </Label>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">…</p>
                ) : isError ? (
                    <div className="mt-1 flex flex-col items-start gap-2">
                        <p className="text-sm text-destructive">
                            {t("watchers.loadFailed")}
                        </p>
                        <Button
                            onClick={() => void refetch()}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("watchers.retry")}
                        </Button>
                    </div>
                ) : watchers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t("watchers.empty")}
                    </p>
                ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <WatchersAvatars watchers={watchers} />
                    </div>
                )}
            </div>

            <Button
                disabled={toggleWatch.isPending || isLoading}
                onClick={() => {
                    void toggleWatch.mutateAsync(isWatching).catch(() => {
                        toast.error(t("watchers.updateFailed"));
                    });
                }}
                size="sm"
                variant="outline"
            >
                {isWatching ? t("watchers.unwatch") : t("watchers.watch")}
            </Button>
        </section>
    );
}

function WatchersAvatars({ watchers }: { watchers: TaskWatcher[] }) {
    const visibleWatchers = watchers.slice(0, MAX_VISIBLE_WATCHERS);
    const overflowCount = watchers.length - visibleWatchers.length;

    return (
        <TooltipProvider delay={200}>
            <div className="group/avatars flex items-center">
                {visibleWatchers.map((watcher, index) => (
                    <div
                        className="group/avatar-item translate-x-[calc(var(--index)*-8px)] transition-all duration-300 ease-in-out will-change-transform group-hover/avatars:translate-x-[calc(var(--index)*6px)]"
                        key={watcher.userId}
                        style={
                            {
                                "--index": index,
                                zIndex: visibleWatchers.length - index,
                            } as CSSProperties
                        }
                    >
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Avatar
                                        className={cn(
                                            "origin-center ring-2 ring-background transition-transform duration-300 ease-in-out",
                                            "group-hover/avatar-item:scale-110"
                                        )}
                                        size="sm"
                                    >
                                        {watcher.avatarUrl ? (
                                            <AvatarImage
                                                alt={watcher.name}
                                                src={watcher.avatarUrl}
                                            />
                                        ) : undefined}
                                        <AvatarFallback>
                                            {watcher.name
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                }
                            />
                            <TooltipContent sideOffset={10}>
                                {watcher.name}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                ))}
                {overflowCount > 0 ? (
                    <span
                        className="translate-x-[calc(var(--index)*-8px)] text-sm text-muted-foreground transition-all duration-300 ease-in-out group-hover/avatars:translate-x-[calc(var(--index)*6px)]"
                        style={
                            {
                                "--index": visibleWatchers.length,
                            } as CSSProperties
                        }
                    >
                        +{overflowCount}
                    </span>
                ) : null}
            </div>
        </TooltipProvider>
    );
}
