/** Clipboard helpers for copying a rich-text image as a real bitmap. */

export type CopyImageResult = "bitmap" | "failed";

/**
 * Puts an image on the system clipboard as a real `image/*` blob so paste works
 * in messengers and image editors. Does not fall back to a storage URL.
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
            // Bitmap copy blocked (CORS, permissions, unsupported type).
        }
    }

    return "failed";
}
