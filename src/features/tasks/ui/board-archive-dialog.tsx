import { Archive, PanelBottom, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
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

export function BoardArchiveDialog({
    boardId,
    projectId,
}: BoardArchiveDialogProperties) {
    const { i18n, t } = useTranslation("board");
    const [open, setOpen] = useState(false);
    const { canDeleteTasks } = useProjectAccess(projectId);
    const { deleteTask, restoreTask } = useBoardTasks(projectId, boardId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const selectedTaskId = useTasksUiStore((state) => state.selectedTaskId);
    const {
        data: archived = [],
        isError,
        isLoading,
    } = useArchivedTasks(projectId, boardId, open);

    const [deleteTarget, setDeleteTarget] = useState<null | {
        id: string;
        key: string;
        title: string;
    }>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [busyId, setBusyId] = useState<null | string>(null);

    const handleRestore = async (taskId: string, key: string) => {
        if (busyId) return;
        setBusyId(taskId);
        try {
            await restoreTask(taskId);
            toast.success(t("archive.restored", { key }));
        } catch {
            toast.error(t("archive.restoreFailed"));
        } finally {
            setBusyId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget || isDeleting) return;
        const { id, key } = deleteTarget;
        setIsDeleting(true);
        try {
            await deleteTask(id);
            setDeleteTarget(null);
            toast.success(t("tasks.deleted", { key }));
        } catch {
            toast.error(t("tasks.deleteFailed"));
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
                <DialogContent className="sm:max-w-lg">
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
                        <ScrollArea className="max-h-[min(24rem,50vh)]">
                            <ul className="flex flex-col gap-2 pr-3">
                                {archived.map((task) => {
                                    const archivedLabel = task.archivedAt
                                        ? new Intl.DateTimeFormat(
                                              i18n.language,
                                              {
                                                  dateStyle: "medium",
                                                  timeStyle: "short",
                                              }
                                          ).format(new Date(task.archivedAt))
                                        : undefined;

                                    return (
                                        <li
                                            className="flex flex-col gap-2 border border-foreground/10 p-3"
                                            key={task.id}
                                        >
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-meta font-mono text-muted-foreground">
                                                    {task.key}
                                                </span>
                                                <span className="font-medium">
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
                                                {canDeleteTasks ? (
                                                    <>
                                                        <Button
                                                            disabled={
                                                                busyId ===
                                                                task.id
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
                                                                busyId ===
                                                                    task.id ||
                                                                isDeleting
                                                            }
                                                            onClick={() =>
                                                                setDeleteTarget(
                                                                    {
                                                                        id: task.id,
                                                                        key: task.key,
                                                                        title: task.title,
                                                                    }
                                                                )
                                                            }
                                                            size="xs"
                                                            type="button"
                                                            variant="destructive"
                                                        >
                                                            <Trash2 data-icon="inline-start" />
                                                            {t("tasks.delete")}
                                                        </Button>
                                                    </>
                                                ) : undefined}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </ScrollArea>
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
                            {t("tasks.deleteTitle", {
                                key: deleteTarget?.key ?? "",
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("tasks.deleteDescription", {
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
