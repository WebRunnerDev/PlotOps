import type { CSSProperties } from "react";

import { Plus, User, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { TaskWatcher } from "@/features/notifications/model/types";
import type { ProjectPerson } from "@/features/projects/model/use-project-people";

import { isGuest } from "@/features/guest-mode";
import {
    eligibleWatcherAddCandidates,
    type WatcherCandidate,
} from "@/features/notifications/lib/eligible-watcher-add-candidates";
import {
    useAddTaskWatcher,
    useRemoveTaskWatcher,
    useTaskWatchers,
    useToggleTaskWatch,
} from "@/features/notifications/model/use-task-watchers";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/shadcn/ui/popover";
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
    const guest = isGuest();
    const { canManageWatchers, isSettled } = useProjectAccess(
        properties.projectId
    );
    const canManageOthers = canManageWatchers && !guest && isSettled;

    const { data, isError, isLoading, refetch } = useTaskWatchers({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });
    const toggleWatch = useToggleTaskWatch({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });
    const addWatcher = useAddTaskWatcher({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });
    const removeWatcher = useRemoveTaskWatcher({
        projectId: properties.projectId,
        taskId: properties.taskId,
    });

    const watchers = data?.watchers ?? [];
    const isWatching = data?.isWatching ?? false;
    const people = useProjectPeople(properties.projectId);
    const [manageOpen, setManageOpen] = useState(false);

    const candidates = useMemo(
        () =>
            eligibleWatcherAddCandidates({
                people,
                watcherUserIds: watchers.map((watcher) => watcher.userId),
            }),
        [people, watchers]
    );

    const busy =
        toggleWatch.isPending ||
        addWatcher.isPending ||
        removeWatcher.isPending ||
        isLoading;

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

            <div className="flex shrink-0 items-center gap-2">
                {canManageOthers ? (
                    <Popover onOpenChange={setManageOpen} open={manageOpen}>
                        <PopoverTrigger
                            render={
                                <Button
                                    aria-label={t("watchers.manage")}
                                    disabled={busy}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                />
                            }
                        >
                            <Plus className="size-3.5" />
                            <span className="hidden sm:inline">
                                {t("watchers.manage")}
                            </span>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="w-72 rounded-none p-3"
                        >
                            <ManageWatchersPanel
                                busy={busy}
                                candidates={candidates}
                                onAdd={(userId) => {
                                    void addWatcher
                                        .mutateAsync(userId)
                                        .catch(() => {
                                            toast.error(
                                                t("watchers.updateFailed")
                                            );
                                        });
                                }}
                                onRemove={(userId) => {
                                    void removeWatcher
                                        .mutateAsync(userId)
                                        .catch(() => {
                                            toast.error(
                                                t("watchers.updateFailed")
                                            );
                                        });
                                }}
                                watchers={watchers}
                            />
                        </PopoverContent>
                    </Popover>
                ) : null}

                <Button
                    disabled={busy}
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
            </div>
        </section>
    );
}

function ManageWatchersPanel({
    busy,
    candidates,
    onAdd,
    onRemove,
    watchers,
}: {
    busy: boolean;
    candidates: WatcherCandidate[];
    onAdd: (userId: string) => void;
    onRemove: (userId: string) => void;
    watchers: TaskWatcher[];
}) {
    const { t } = useTranslation("board");
    const emptySelection: null | ProjectPerson = null;

    return (
        <div className="flex flex-col gap-3">
            <p className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                {t("watchers.manage")}
            </p>

            {watchers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t("watchers.empty")}
                </p>
            ) : (
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {watchers.map((watcher) => (
                        <li
                            className="flex min-w-0 items-center gap-2"
                            key={watcher.userId}
                        >
                            <WatcherAvatar size="sm" watcher={watcher} />
                            <span className="min-w-0 flex-1 truncate text-sm">
                                {watcher.name}
                            </span>
                            <Button
                                aria-label={t("watchers.remove", {
                                    name: watcher.name,
                                })}
                                className="size-7 shrink-0"
                                disabled={busy}
                                onClick={() => onRemove(watcher.userId)}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <XIcon className="size-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-col gap-1.5">
                <Label
                    className="text-meta font-medium tracking-[0.06em] text-muted-foreground"
                    htmlFor="add-watcher"
                >
                    {t("watchers.add")}
                </Label>
                <Combobox
                    disabled={busy || candidates.length === 0}
                    isItemEqualToValue={(
                        left: null | ProjectPerson,
                        right: null | ProjectPerson
                    ) => left?.id === right?.id}
                    items={candidates}
                    itemToStringLabel={(item: null | ProjectPerson) =>
                        item?.name ?? ""
                    }
                    onValueChange={(next: null | ProjectPerson) => {
                        if (!next) return;
                        onAdd(next.id);
                    }}
                    value={emptySelection}
                >
                    <ComboboxInput
                        className="w-full rounded-none font-mono text-code"
                        disabled={busy || candidates.length === 0}
                        id="add-watcher"
                        placeholder={t("watchers.addPlaceholder")}
                    />
                    <ComboboxContent>
                        <ComboboxEmpty>{t("watchers.addEmpty")}</ComboboxEmpty>
                        <ComboboxList>
                            {(person: ProjectPerson) => (
                                <ComboboxItem key={person.id} value={person}>
                                    <span className="flex min-w-0 items-center gap-2">
                                        <MemberAvatar person={person} />
                                        <span className="truncate">
                                            {person.name}
                                        </span>
                                    </span>
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            </div>
        </div>
    );
}

function MemberAvatar({ person }: { person: ProjectPerson }) {
    return (
        <Avatar className="size-5 rounded-none" size="sm">
            {person.avatarUrl ? (
                <AvatarImage alt="" src={person.avatarUrl} />
            ) : undefined}
            <AvatarFallback className="rounded-none text-meta">
                {person.name ? (
                    person.name.slice(0, 2).toUpperCase()
                ) : (
                    <User className="size-3" />
                )}
            </AvatarFallback>
        </Avatar>
    );
}

function WatcherAvatar({
    className,
    size = "default",
    watcher,
}: {
    className?: string;
    size?: "default" | "sm";
    watcher: TaskWatcher;
}) {
    return (
        <Avatar
            className={cn(
                size === "sm" && "size-5 rounded-none",
                "origin-center ring-2 ring-background",
                className
            )}
            size="sm"
        >
            {watcher.avatarUrl ? (
                <AvatarImage alt={watcher.name} src={watcher.avatarUrl} />
            ) : undefined}
            <AvatarFallback
                className={size === "sm" ? "rounded-none" : undefined}
            >
                {watcher.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
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
                                    <WatcherAvatar
                                        className={cn(
                                            "transition-transform duration-300 ease-in-out",
                                            "group-hover/avatar-item:scale-110"
                                        )}
                                        watcher={watcher}
                                    />
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
