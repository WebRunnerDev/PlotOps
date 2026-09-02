/** Shareable deep link that opens a Task drawer on the correct Board. */
export function buildTaskShareUrl(input: {
    origin?: string;
    projectSlug: string;
    taskKey: string;
}): string {
    const origin =
        input.origin ??
        (globalThis.location === undefined ? "" : globalThis.location.origin);
    const projectSlug = encodeURIComponent(input.projectSlug.trim());
    const taskKey = encodeURIComponent(input.taskKey.trim());
    return `${origin}/projects/${projectSlug}/tasks/${taskKey}`;
}
