import type { Task } from "@/features/tasks/model/types";

/** Default GitHub PR title from task key + title (ADR 0022). */
export function defaultPullRequestTitle(
    task: Pick<Task, "key" | "title">
): string {
    return `${task.key}: ${task.title}`;
}
