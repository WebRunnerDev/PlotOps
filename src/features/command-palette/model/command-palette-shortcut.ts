/** Physical K key — same position as Л on Russian ЙЦУКЕН. */
export function isCommandPaletteShortcut(
    event: Pick<KeyboardEvent, "code" | "ctrlKey" | "key" | "metaKey">
): boolean {
    if (!(event.metaKey || event.ctrlKey)) {
        return false;
    }

    if (event.code === "KeyK") {
        return true;
    }

    const key = event.key.toLowerCase();
    return key === "k" || key === "л";
}
