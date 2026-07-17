import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
    const {
        attributes,
        isDragging,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({
        data: { status: task.status, type: "task" },
        id: task.id,
    });

    return (
        <div
            className={cn(
                "touch-none outline-none transition-opacity duration-150",
                isDragging &&
                    "rounded-xl opacity-40 ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
            )}
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
            }}
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
