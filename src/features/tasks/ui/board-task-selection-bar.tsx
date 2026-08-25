import { Archive, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    PARENT_GATE_TOAST_KEY,
    parentGateRefusalFromError,
} from "@/features/tasks/lib/task-structure";
import { useBoardTaskSelectionStore } from "@/features/tasks/model/use-board-task-selection-store";
import { useBoardTasks } from "@/features/tasks/model/use-board-tasks";
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
import { Spinner } from "@/shared/shadcn/ui/spinner";

const CONFIRM_THRESHOLD = 10;

type BoardTaskSelectionBarProperties = {
    boardId: string;
    projectId: string;
};

export function BoardTaskSelectionBar({
    boardId,
    projectId,
}: BoardTaskSelectionBarProperties) {
    const { t } = useTranslation("board");
    const selectedIds = useBoardTaskSelectionStore(
        (state) => state.selectedIds
    );
    const clearSelection = useBoardTaskSelectionStore(
        (state) => state.clearSelection
    );
    const storeBoardId = useBoardTaskSelectionStore((state) => state.boardId);
    const { archiveTasks } = useBoardTasks(projectId, boardId);
    const { canDeleteTasks, isSettled } = useProjectAccess(projectId);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const count = storeBoardId === boardId ? selectedIds.size : 0;
    const canArchive = isSettled && canDeleteTasks;

    if (count === 0) {
        return null;
    }

    const taskIds = [...selectedIds];

    const runArchive = async () => {
        if (!canArchive || isArchiving) return;
        setIsArchiving(true);
        try {
            await archiveTasks(taskIds);
            clearSelection();
            toast.success(t("selection.archived", { count: taskIds.length }));
        } catch (error) {
            const reason = parentGateRefusalFromError(error);
            toast.error(
                reason
                    ? t(PARENT_GATE_TOAST_KEY[reason])
                    : t("selection.archiveFailed")
            );
        } finally {
            setIsArchiving(false);
            setConfirmOpen(false);
        }
    };

    const onArchiveClick = () => {
        if (taskIds.length >= CONFIRM_THRESHOLD) {
            setConfirmOpen(true);
            return;
        }
        void runArchive();
    };

    // Portal + fixed so the bar is outside the board's w-max + overflow-x scroller
    // (in-flow sticky width was expanding layout and showing a horizontal scrollbar).
    return createPortal(
        <>
            <div
                className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-4"
                data-slot="board-task-selection-bar"
            >
                <div className="pointer-events-auto flex min-w-0 max-w-full items-center gap-2 border border-primary bg-popover px-3 py-2 shadow-md">
                    <span className="min-w-0 truncate text-ui text-muted-foreground">
                        {t("selection.count", { count })}
                    </span>
                    <Button
                        disabled={isArchiving}
                        onClick={clearSelection}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <X data-icon="inline-start" />
                        {t("selection.clear")}
                    </Button>
                    {canArchive ? (
                        <Button
                            disabled={isArchiving}
                            onClick={onArchiveClick}
                            size="sm"
                            type="button"
                            variant="destructive"
                        >
                            {isArchiving ? (
                                <Spinner data-icon="inline-start" />
                            ) : (
                                <Archive data-icon="inline-start" />
                            )}
                            {t("selection.archive", { count })}
                        </Button>
                    ) : null}
                </div>
            </div>

            <AlertDialog
                onOpenChange={(open) => {
                    if (!open && !isArchiving) setConfirmOpen(false);
                }}
                open={confirmOpen}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("selection.confirmTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("selection.confirmDescription", { count })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isArchiving}>
                            {t("selection.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isArchiving}
                            onClick={() => {
                                void runArchive();
                            }}
                            variant="destructive"
                        >
                            {isArchiving ? (
                                <Spinner data-icon="inline-start" />
                            ) : null}
                            {t("selection.archive", { count })}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>,
        document.body
    );
}
