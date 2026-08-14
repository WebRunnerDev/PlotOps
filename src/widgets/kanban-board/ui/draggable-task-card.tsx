import type { KeyboardEvent } from "react";

import { useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ProjectLabel } from "@/features/labels";

import {
    type SubtaskProgress,
    type Task,
    TaskCard,
    useBoardTaskSelectionStore,
    useTasksUiStore,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { gateDragListeners } from "@/widgets/kanban-board/model/gate-drag-pointer-down";
import { shouldOpenTaskFromKeyboard } from "@/widgets/kanban-board/model/should-open-task-from-keyboard";
import { shouldOpenTaskFromPointer } from "@/widgets/kanban-board/model/should-open-task-from-pointer";

type DraggableTaskCardProperties = {
    boardId: string;
    canDrag: boolean;
    labels: ProjectLabel[];
    selectionEnabled: boolean;
    subtaskProgress?: SubtaskProgress;
    task: Task;
};

export function DraggableTaskCard({
    boardId,
    canDrag,
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
    const { active } = useDndContext();
    const suppressOpenAfterDrag = useRef(false);
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

    const openTask = () => {
        if (
            !shouldOpenTaskFromPointer(
                isDragging,
                suppressOpenAfterDrag.current
            )
        ) {
            return;
        }
        selectTask(task.id);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!shouldOpenTaskFromKeyboard(event, isDragging)) {
            return;
        }
        event.preventDefault();
        selectTask(task.id);
    };

    const dragListeners = canDrag ? gateDragListeners(listeners) : undefined;

    return (
        <div
            aria-label={task.key}
            className={cn(
                "group/task relative min-w-0 cursor-pointer rounded-lg outline-none transition-opacity duration-150",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                (isDragging || multiDragGhost) &&
                    "opacity-40 ring-2 ring-inset ring-primary/50",
                // Inset ring: no ring-offset, so selection never grows card width.
                isSelected &&
                    !isDragging &&
                    !multiDragGhost &&
                    "ring-2 ring-inset ring-primary/60"
            )}
            onClick={openTask}
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
