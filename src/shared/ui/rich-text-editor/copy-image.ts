/** Clipboard helpers for copying a rich-text image as a real bitmap. */

export type CopyImageResult = "bitmap" | "failed" | "url";

/**
 * Puts an image on the system clipboard. Prefers a real `image/*` blob so paste
 * works in messengers and image editors; falls back to the URL as plain text
 * when fetch/CORS/clipboard permissions block the bitmap path.
 */
export async function copyImageSourceToClipboard(
    source: string,
    options?: {
        clipboard?: Pick<Clipboard, "write" | "writeText">;
        fetchImpl?: typeof fetch;
    }
): Promise<CopyImageResult> {
    const trimmed = source.trim();
    if (!trimmed) return "failed";

    const clipboard = options?.clipboard ?? globalThis.navigator?.clipboard;
    const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

    if (!clipboard) return "failed";

    if (
        typeof fetchImpl === "function" &&
        typeof clipboard.write === "function" &&
        typeof ClipboardItem !== "undefined"
    ) {
        try {
            const response = await fetchImpl(trimmed, { mode: "cors" });
            if (response.ok) {
                const blob = await response.blob();
                if (blob.type.startsWith("image/")) {
                    await clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob,
                        }),
                    ]);
                    return "bitmap";
                }
            }
        } catch {
            // Fall through to URL-only copy.
        }
    }

    if (typeof clipboard.writeText !== "function") return "failed";

    try {
        await clipboard.writeText(trimmed);
        return "url";
    } catch {
        return "failed";
    }
}
