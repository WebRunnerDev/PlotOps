import { useDraggable } from "@dnd-kit/core";

import {
    type ProjectLabel,
    type Task,
    TaskCard,
    useTasksStore,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";

type DraggableTaskCardProperties = {
    labels: ProjectLabel[];
    task: Task;
};

export function DraggableTaskCard({
    labels,
    task,
}: DraggableTaskCardProperties) {
    const selectTask = useTasksStore((state) => state.selectTask);
    const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
        data: { status: task.status, type: "task" },
        id: task.id,
    });

    return (
        <div
            className={cn(
                "touch-none outline-none",
                isDragging && "opacity-40",
            )}
            ref={setNodeRef}
            {...listeners}
            {...attributes}
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
