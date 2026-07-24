import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ProjectLabel } from "@/features/labels";

import { type Task, TaskCard, useTasksUiStore } from "@/features/tasks";
import { cn } from "@/shared/lib/utils";

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

    return (
        <div
            className={cn(
                "outline-none transition-opacity duration-150",
                canDrag && "touch-none",
                isDragging &&
                    "rounded-lg opacity-40 ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
            )}
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
            {...(canDrag ? listeners : undefined)}
            {...(canDrag ? attributes : undefined)}
            onClick={() => {
                if (!isDragging) {
                    selectTask(task.id);
                }
            }}
        >
            <TaskCard labels={labels} task={task} />
        </div>
    );
}
