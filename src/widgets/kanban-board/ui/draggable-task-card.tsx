import type { KeyboardEvent } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";

import type { ProjectLabel } from "@/features/labels";

import { type Task, TaskCard, useTasksUiStore } from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { shouldOpenTaskFromKeyboard } from "@/widgets/kanban-board/model/should-open-task-from-keyboard";
import { shouldOpenTaskFromPointer } from "@/widgets/kanban-board/model/should-open-task-from-pointer";

type DraggableTaskCardProperties = {
    canDrag: boolean;
    labels: ProjectLabel[];
    task: Task;
};

export function DraggableTaskCard({
    canDrag,
    labels,
    task,
}: DraggableTaskCardProperties) {
    const selectTask = useTasksUiStore((state) => state.selectTask);
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

    return (
        <div
            aria-label={task.key}
            className={cn(
                "cursor-pointer rounded-lg outline-none transition-opacity duration-150",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                canDrag && "touch-none",
                isDragging &&
                    "opacity-40 ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
            )}
            onClick={openTask}
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
            {...(canDrag ? listeners : undefined)}
            {...(canDrag ? attributes : undefined)}
            onKeyDown={onKeyDown}
            role="button"
            tabIndex={0}
        >
            <TaskCard labels={labels} task={task} />
        </div>
    );
}
