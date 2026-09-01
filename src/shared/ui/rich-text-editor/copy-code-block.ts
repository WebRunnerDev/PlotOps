/** Copies a code block's plain text to the system clipboard. */

export async function copyCodeBlockText(
    text: string,
    options?: {
        clipboard?: Pick<Clipboard, "writeText">;
    }
): Promise<boolean> {
    if (!text) return false;

    const clipboard = options?.clipboard ?? globalThis.navigator?.clipboard;
    if (!clipboard || typeof clipboard.writeText !== "function") {
        return false;
    }

    try {
        await clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
