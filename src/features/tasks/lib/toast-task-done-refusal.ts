import { toast } from "sonner";

import {
    TASK_DONE_TOAST_KEY,
    type TaskDoneRefusal,
} from "@/features/tasks/lib/task-structure";

export function taskDoneRefusalToastId(reason: TaskDoneRefusal): string {
    return `task-done-refused:${reason}`;
}

export function toastTaskDoneRefusal(
    translate: (key: string) => string,
    reason: TaskDoneRefusal
): void {
    toast.error(translate(TASK_DONE_TOAST_KEY[reason]), {
        id: taskDoneRefusalToastId(reason),
    });
}
