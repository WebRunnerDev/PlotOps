import type { KeyboardEvent } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ProjectLabel } from "@/features/labels";

import { type Task, TaskCard, useTasksUiStore } from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import { shouldOpenTaskFromKeyboard } from "@/widgets/kanban-board/model/should-open-task-from-keyboard";

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

    const openTask = () => {
        if (!isDragging) {
            selectTask(task.id);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!shouldOpenTaskFromKeyboard(event, isDragging)) {
            return;
        }
        event.preventDefault();
        openTask();
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
