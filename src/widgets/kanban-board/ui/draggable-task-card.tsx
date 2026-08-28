import type { KeyboardEvent, MouseEvent } from "react";

import { useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { startTransition, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";

import {
    type SubtaskProgress,
    type Task,
    TaskCard,
    useBoardTaskSelectionStore,
    useTasksUiStore,
} from "@/features/tasks";
import {
    isBoardMultiSelectModifier,
    shouldPreventBoardTaskTextSelection,
} from "@/features/tasks/lib/board-task-selection";
import { cn } from "@/shared/lib/utils";
import { gateDragListeners } from "@/widgets/kanban-board/model/gate-drag-pointer-down";
import { shouldOpenTaskFromKeyboard } from "@/widgets/kanban-board/model/should-open-task-from-keyboard";
import { shouldOpenTaskFromPointer } from "@/widgets/kanban-board/model/should-open-task-from-pointer";

type DraggableTaskCardProperties = {
    boardId: string;
    canDrag: boolean;
    columnTaskIds: readonly string[];
    labels: ProjectLabel[];
    selectionEnabled: boolean;
    subtaskProgress?: SubtaskProgress;
    task: Task;
};

export function DraggableTaskCard({
    boardId,
    canDrag,
    columnTaskIds,
    labels,
    selectionEnabled,
    subtaskProgress,
    task,
}: DraggableTaskCardProperties) {
    const { t } = useTranslation("board");
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const selectedIds = useBoardTaskSelectionStore(
        (state) => state.selectedIds
    );
    const storeBoardId = useBoardTaskSelectionStore((state) => state.boardId);
    const toggleTask = useBoardTaskSelectionStore((state) => state.toggleTask);
    const selectRangeInColumn = useBoardTaskSelectionStore(
        (state) => state.selectRangeInColumn
    );
    const { active } = useDndContext();
    const suppressOpenAfterDrag = useRef(false);
    const singleClickTimer = useRef<null | ReturnType<typeof setTimeout>>(null);
    const {
        attributes,
        isDragging,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        data: { status: task.status, type: "task" },
        disabled: !canDrag,
        id: task.id,
    });

    const isSelected =
        selectionEnabled &&
        storeBoardId === boardId &&
        selectedIds.has(task.id);
    const selectionActive =
        selectionEnabled && storeBoardId === boardId && selectedIds.size > 0;
    const multiDragGhost =
        isSelected &&
        !isDragging &&
        active?.data.current?.type === "task" &&
        selectedIds.has(String(active.id)) &&
        selectedIds.size > 1;

    useEffect(() => {
        if (isDragging) {
            suppressOpenAfterDrag.current = true;
            return;
        }

        if (!suppressOpenAfterDrag.current) return;

        const clear = globalThis.setTimeout(() => {
            suppressOpenAfterDrag.current = false;
        }, 0);
        return () => globalThis.clearTimeout(clear);
    }, [isDragging]);

    useEffect(() => {
        return () => {
            if (singleClickTimer.current !== null) {
                globalThis.clearTimeout(singleClickTimer.current);
            }
        };
    }, []);

    const cancelPendingSingleClick = () => {
        if (singleClickTimer.current === null) return;
        globalThis.clearTimeout(singleClickTimer.current);
        singleClickTimer.current = null;
    };

    const openTaskDrawer = () => {
        startTransition(() => {
            selectTask(task.id);
        });
    };

    const handleCardDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        cancelPendingSingleClick();
        if (
            !shouldOpenTaskFromPointer(
                isDragging,
                suppressOpenAfterDrag.current
            )
        ) {
            return;
        }
        openTaskDrawer();
    };

    const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
        if (
            !shouldOpenTaskFromPointer(
                isDragging,
                suppressOpenAfterDrag.current
            )
        ) {
            return;
        }

        if (selectionEnabled) {
            if (event.shiftKey) {
                cancelPendingSingleClick();
                selectRangeInColumn(boardId, columnTaskIds, task.id);
                return;
            }
            if (isBoardMultiSelectModifier(event)) {
                cancelPendingSingleClick();
                toggleTask(boardId, task.id);
                return;
            }
            if (selectionActive) {
                cancelPendingSingleClick();
                singleClickTimer.current = globalThis.setTimeout(() => {
                    singleClickTimer.current = null;
                    toggleTask(boardId, task.id);
                }, 250);
                return;
            }
        }

        openTaskDrawer();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!shouldOpenTaskFromKeyboard(event, isDragging)) {
            return;
        }
        event.preventDefault();
        openTaskDrawer();
    };

    const dragListeners = canDrag ? gateDragListeners(listeners) : undefined;

    const handleCardMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (
            shouldPreventBoardTaskTextSelection({
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                selectionActive,
                selectionEnabled,
                shiftKey: event.shiftKey,
            })
        ) {
            event.preventDefault();
        }
    };

    return (
        <div
            aria-label={task.key}
            className={cn(
                "group/task relative min-w-0 cursor-pointer select-none rounded-lg outline-none transition-opacity duration-150",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                (isDragging || multiDragGhost) &&
                    "opacity-40 ring-2 ring-inset ring-primary/50",
                // Inset ring: no ring-offset, so selection never grows card width.
                isSelected &&
                    !isDragging &&
                    !multiDragGhost &&
                    "ring-2 ring-inset ring-primary/60"
            )}
            onClick={handleCardClick}
            onDoubleClick={handleCardDoubleClick}
            onMouseDown={handleCardMouseDown}
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
            {...(canDrag ? attributes : undefined)}
            {...(dragListeners ?? undefined)}
            onKeyDown={onKeyDown}
            role="button"
            tabIndex={0}
        >
            <TaskCard
                labels={labels}
                selection={
                    selectionEnabled
                        ? {
                              checked: isSelected,
                              forceVisible: selectionActive,
                              onCheckedChange: () => {
                                  toggleTask(boardId, task.id);
                              },
                              toggleLabel: t("selection.toggleTask", {
                                  key: task.key,
                              }),
                          }
                        : undefined
                }
                subtaskProgress={subtaskProgress}
                task={task}
            />
        </div>
    );
}
