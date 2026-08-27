import { Archive, PanelBottom, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    PARENT_GATE_TOAST_KEY,
    parentGateRefusalFromError,
} from "@/features/tasks/lib/task-structure";
import { useArchivedTasks } from "@/features/tasks/model/use-archived-tasks";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/shadcn/ui/alert-dialog";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/shadcn/ui/dialog";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type BoardArchiveDialogProperties = {
    boardId: string;
    projectId: string;
};

type DeleteTarget =
    | { count: number; ids: string[]; mode: "bulk" }
    | { id: string; key: string; mode: "single"; title: string };

const EMPTY_ARCHIVED: never[] = [];
const EMPTY_ARCHIVED_IDS: string[] = [];

export function BoardArchiveDialog({
    boardId,
    projectId,
}: BoardArchiveDialogProperties) {
    const { i18n, t } = useTranslation("board");
    const [open, setOpen] = useState(false);
    const { canDeleteTasks, isSettled } = useProjectAccess(projectId);
    const canDelete = isSettled && canDeleteTasks;
    const { deleteTask, deleteTasks, restoreTask, restoreTasks } =
        useBoardTasks(projectId, boardId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const archiveDialogOpenRequestKey = useTasksUiStore(
        (state) => state.archiveDialogOpenRequestKey
    );
    const lastArchiveOpenRequestKey = useRef(0);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busyId, setBusyId] = useState<null | string>(null);
    const [isBulkBusy, setIsBulkBusy] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        () => new Set()
    );
    const {
        data: archivedData,
        isError,
        isLoading,
    } = useArchivedTasks(projectId, boardId, open);
    const archived = archivedData ?? EMPTY_ARCHIVED;

    const archivedIds = useMemo(
        () =>
            archived.length === 0
                ? EMPTY_ARCHIVED_IDS
                : archived.map((task) => task.id),
        [archived]
    );

    useEffect(() => {
        if (
            !archiveDialogOpenRequestKey ||
            archiveDialogOpenRequestKey === lastArchiveOpenRequestKey.current
        ) {
            return;
        }
        lastArchiveOpenRequestKey.current = archiveDialogOpenRequestKey;
        setOpen(true);
    }, [archiveDialogOpenRequestKey]);

    useEffect(() => {
        if (!open) {
            setSelectedIds((current) =>
                current.size === 0 ? current : new Set()
            );
            return;
        }
        setSelectedIds((current) => {
            if (current.size === 0) return current;
            const allowed = new Set(archivedIds);
            let changed = false;
            const next = new Set<string>();
            for (const id of current) {
                if (allowed.has(id)) {
                    next.add(id);
                } else {
                    changed = true;
                }
            }
            return changed ? next : current;
        });
    }, [archivedIds, open]);

    const selectedCount = selectedIds.size;
    const allSelected =
        archivedIds.length > 0 && selectedCount === archivedIds.length;
    const someSelected = selectedCount > 0 && !allSelected;
    const actionsLocked = Boolean(busyId) || isBulkBusy || isDeleting;

    const toggleTask = (taskId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelectedIds((current) => {
            if (archivedIds.length > 0 && current.size === archivedIds.length) {
                return new Set();
            }
            return new Set(archivedIds);
        });
    };

    const handleRestore = async (taskId: string, key: string) => {
        if (actionsLocked) return;
        setBusyId(taskId);
        try {
            await restoreTask(taskId);
            setSelectedIds((current) => {
                if (!current.has(taskId)) return current;
                const next = new Set(current);
                next.delete(taskId);
                return next;
            });
            toast.success(t("archive.restored", { key }));
        } catch {
            toast.error(t("archive.restoreFailed"));
        } finally {
            setBusyId(null);
        }
    };

    const handleBulkRestore = async () => {
        if (!canDelete || actionsLocked || selectedCount === 0) return;
        const ids = [...selectedIds];
        setIsBulkBusy(true);
        try {
            await restoreTasks(ids);
            setSelectedIds(new Set());
            toast.success(t("archive.restoredCount", { count: ids.length }));
        } catch {
            toast.error(t("archive.restoreFailed"));
        } finally {
            setIsBulkBusy(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || isDeleting) return;
        setIsDeleting(true);
        try {
            if (deleteTarget.mode === "single") {
                const { id, key } = deleteTarget;
                await deleteTask(id);
                setSelectedIds((current) => {
                    if (!current.has(id)) return current;
                    const next = new Set(current);
                    next.delete(id);
                    return next;
                });
                setDeleteTarget(null);
                toast.success(t("tasks.deleted", { key }));
                return;
            }

            const { count, ids } = deleteTarget;
            await deleteTasks(ids);
            setSelectedIds(new Set());
            setDeleteTarget(null);
            toast.success(t("archive.deletedCount", { count }));
        } catch (error) {
            const reason = parentGateRefusalFromError(error);
            toast.error(
                reason
                    ? t(PARENT_GATE_TOAST_KEY[reason])
                    : t("tasks.deleteFailed")
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Dialog
                onOpenChange={(next) => {
                    // Stay open under the task drawer so multiple archived tasks can be reviewed.
                    if (!next && selectedTaskId) return;
                    setOpen(next);
                }}
                open={open}
            >
                <DialogTrigger
                    render={
                        <Button size="xs" type="button" variant="outline" />
                    }
                >
                    <Archive data-icon="inline-start" />
                    {t("archive.open")}
                </DialogTrigger>
                <DialogContent className="min-w-0 max-sm:top-0 max-sm:left-0 max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t("archive.title")}</DialogTitle>
                        <DialogDescription>
                            {t("archive.description")}
                        </DialogDescription>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Spinner className="size-6 text-primary" />
                        </div>
                    ) : isError ? (
                        <p className="text-sm text-destructive">
                            {t("archive.loadFailed")}
                        </p>
                    ) : archived.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("archive.empty")}
                        </p>
                    ) : (
                        <div className="flex min-w-0 flex-col gap-3">
                            {canDelete ? (
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                                        <Checkbox
                                            aria-label={t("archive.selectAll")}
                                            checked={allSelected}
                                            disabled={actionsLocked}
                                            indeterminate={someSelected}
                                            onCheckedChange={() => {
                                                toggleSelectAll();
                                            }}
                                        />
                                        <span className="truncate">
                                            {selectedCount > 0
                                                ? t("selection.count", {
                                                      count: selectedCount,
                                                  })
                                                : t("archive.selectAll")}
                                        </span>
                                    </label>
                                    {selectedCount > 0 ? (
                                        <div className="flex min-w-0 flex-wrap gap-2 sm:ml-auto">
                                            <Button
                                                disabled={actionsLocked}
                                                onClick={() => {
                                                    setSelectedIds(new Set());
                                                }}
                                                size="xs"
                                                type="button"
                                                variant="ghost"
                                            >
                                                {t("selection.clear")}
                                            </Button>
                                            <Button
                                                disabled={actionsLocked}
                                                onClick={() => {
                                                    void handleBulkRestore();
                                                }}
                                                size="xs"
                                                type="button"
                                                variant="outline"
                                            >
                                                {isBulkBusy ? (
                                                    <Spinner data-icon="inline-start" />
                                                ) : (
                                                    <RotateCcw data-icon="inline-start" />
                                                )}
                                                {t("archive.restoreSelected", {
                                                    count: selectedCount,
                                                })}
                                            </Button>
                                            <Button
                                                disabled={actionsLocked}
                                                onClick={() => {
                                                    setDeleteTarget({
                                                        count: selectedCount,
                                                        ids: [...selectedIds],
                                                        mode: "bulk",
                                                    });
                                                }}
                                                size="xs"
                                                type="button"
                                                variant="destructive"
                                            >
                                                <Trash2 data-icon="inline-start" />
                                                {t("archive.deleteSelected", {
                                                    count: selectedCount,
                                                })}
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            <ScrollArea className="max-h-[min(24rem,50dvh)]">
                                <ul className="flex min-w-0 flex-col gap-2 pr-3">
                                    {archived.map((task) => {
                                        const archivedLabel = task.archivedAt
                                            ? new Intl.DateTimeFormat(
                                                  i18n.language,
                                                  {
                                                      dateStyle: "medium",
                                                      timeStyle: "short",
                                                  }
                                              ).format(
                                                  new Date(task.archivedAt)
                                              )
                                            : undefined;
                                        const isSelected = selectedIds.has(
                                            task.id
                                        );

                                        return (
                                            <li
                                                className="flex min-w-0 flex-col gap-2 border border-foreground/10 p-3"
                                                key={task.id}
                                            >
                                                <div className="flex min-w-0 items-start gap-2">
                                                    {canDelete ? (
                                                        <Checkbox
                                                            aria-label={t(
                                                                "selection.toggleTask",
                                                                {
                                                                    key: task.key,
                                                                }
                                                            )}
                                                            checked={isSelected}
                                                            className="mt-0.5"
                                                            disabled={
                                                                actionsLocked
                                                            }
                                                            onCheckedChange={() => {
                                                                toggleTask(
                                                                    task.id
                                                                );
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                        <span className="text-meta font-mono text-muted-foreground">
                                                            {task.key}
                                                        </span>
                                                        <span className="min-w-0 font-medium wrap-break-word">
                                                            {task.title}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {task.archivedBy
                                                                ? t(
                                                                      "archive.archivedByAt",
                                                                      {
                                                                          name: task
                                                                              .archivedBy
                                                                              .name,
                                                                          when:
                                                                              archivedLabel ??
                                                                              "",
                                                                      }
                                                                  )
                                                                : archivedLabel
                                                                  ? t(
                                                                        "archive.archivedAt",
                                                                        {
                                                                            when: archivedLabel,
                                                                        }
                                                                    )
                                                                  : null}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            selectTask(task.id);
                                                        }}
                                                        size="xs"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        <PanelBottom data-icon="inline-start" />
                                                        {t("archive.view")}
                                                    </Button>
                                                    {canDelete ? (
                                                        <>
                                                            <Button
                                                                disabled={
                                                                    actionsLocked
                                                                }
                                                                onClick={() => {
                                                                    void handleRestore(
                                                                        task.id,
                                                                        task.key
                                                                    );
                                                                }}
                                                                size="xs"
                                                                type="button"
                                                                variant="outline"
                                                            >
                                                                <RotateCcw data-icon="inline-start" />
                                                                {t(
                                                                    "archive.restore"
                                                                )}
                                                            </Button>
                                                            <Button
                                                                disabled={
                                                                    actionsLocked
                                                                }
                                                                onClick={() =>
                                                                    setDeleteTarget(
                                                                        {
                                                                            id: task.id,
                                                                            key: task.key,
                                                                            mode: "single",
                                                                            title: task.title,
                                                                        }
                                                                    )
                                                                }
                                                                size="xs"
                                                                type="button"
                                                                variant="destructive"
                                                            >
                                                                <Trash2 data-icon="inline-start" />
                                                                {t(
                                                                    "tasks.delete"
                                                                )}
                                                            </Button>
                                                        </>
                                                    ) : undefined}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </ScrollArea>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                onOpenChange={(next) => {
                    if (!next && !isDeleting) setDeleteTarget(null);
                }}
                open={deleteTarget !== null}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteTarget?.mode === "bulk"
                                ? t("archive.bulkDeleteTitle", {
                                      count: deleteTarget.count,
                                  })
                                : t("tasks.deleteTitle", {
                                      key: deleteTarget?.key ?? "",
                                  })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.mode === "bulk"
                                ? t("archive.bulkDeleteDescription", {
                                      count: deleteTarget.count,
                                  })
                                : t("tasks.deleteDescription", {
                                      title: deleteTarget?.title ?? "",
                                  })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            {t("tasks.deleteCancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            onClick={() => {
                                void handleConfirmDelete();
                            }}
                            variant="destructive"
                        >
                            {t("tasks.deleteConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
