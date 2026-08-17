import type { Task } from "@/features/tasks/model/types";

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
