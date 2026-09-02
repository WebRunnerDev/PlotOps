import type { Task } from "@/features/tasks/model/types";

/** In-place board/backlog filter — empty query returns the same tasks. */
export function filterTasksBySearchQuery<T extends Pick<Task, "key" | "title">>(
    tasks: readonly T[],
    query: string
): T[] {
    const needle = query.trim();
    if (!needle) return [...tasks];
    return tasks.filter((task) => matchesTaskSearchQuery(task, needle));
}

/** Case-insensitive substring match on key, title, and optional extra haystack. */
export function matchesTaskSearchQuery(
    task: Pick<Task, "key" | "title">,
    query: string,
    extras: readonly string[] = []
): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${task.key} ${task.title} ${extras.join(" ")}`
        .toLowerCase()
        .includes(needle);
}
