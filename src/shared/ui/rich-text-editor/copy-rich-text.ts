/** Writes HTML + plain text to the clipboard (Notion/Jira-style rich copy). */

export async function copyRichTextToClipboard(
    html: string,
    plain: string,
    options?: {
        clipboard?: Pick<Clipboard, "write" | "writeText">;
    }
): Promise<boolean> {
    const trimmedHtml = html.trim();
    const trimmedPlain = plain.trim();
    if (!trimmedHtml && !trimmedPlain) return false;

    const clipboard = options?.clipboard ?? globalThis.navigator?.clipboard;
    if (!clipboard) return false;

    if (
        trimmedHtml &&
        typeof clipboard.write === "function" &&
        typeof ClipboardItem !== "undefined"
    ) {
        try {
            await clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([trimmedHtml], { type: "text/html" }),
                    "text/plain": new Blob([trimmedPlain || trimmedHtml], {
                        type: "text/plain",
                    }),
                }),
            ]);
            return true;
        } catch {
            // Fall through to plain text.
        }
    }

    if (!trimmedPlain || typeof clipboard.writeText !== "function") {
        return false;
    }

    try {
        await clipboard.writeText(trimmedPlain);
        return true;
    } catch {
        return false;
    }
}
