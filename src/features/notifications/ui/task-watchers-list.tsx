import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { TaskWatcher } from "@/features/notifications/model/types";

import {
    useTaskWatchers,
    useToggleTaskWatch,
} from "@/features/notifications/model/use-task-watchers";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Label } from "@/shared/shadcn/ui/label";

export function TaskWatchersList(properties: {
    projectId: string;
    taskId: string;
}) {
    const { t } = useTranslation("board");
    const { data, isLoading } = useTaskWatchers({
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
                <Label className="text-meta text-muted-foreground">
                    {t("watchers.title")}
                </Label>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">…</p>
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
    return (
        <div className="flex items-center">
            <div className="flex -space-x-2">
                {watchers.slice(0, 8).map((watcher) => (
                    <Avatar
                        className="border border-background"
                        key={watcher.userId}
                        size="sm"
                    >
                        {watcher.avatarUrl ? (
                            <AvatarImage alt="" src={watcher.avatarUrl} />
                        ) : undefined}
                        <AvatarFallback>
                            {watcher.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                ))}
            </div>
            {watchers.length > 8 ? (
                <span className="ml-2 text-sm text-muted-foreground">
                    +{watchers.length - 8}
                </span>
            ) : null}
        </div>
    );
}
