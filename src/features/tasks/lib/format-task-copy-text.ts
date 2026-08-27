import { richTextToPlainText } from "@/shared/ui/rich-text-editor/content";

/** Clipboard payload for a one-click copy of a task title and description. */
export function formatTaskCopyText(title: string, description: string): string {
    const heading = title.trim();
    const body = richTextToPlainText(description);
    if (!body) return heading;
    if (!heading) return body;
    return `${heading}\n\n${body}`;
}
