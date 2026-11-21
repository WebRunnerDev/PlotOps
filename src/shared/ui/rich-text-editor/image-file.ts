// Kept free of TipTap imports so non-editor code (uploads) does not pull the
// editor bundle into the main chunk.

const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp)$/i;

const IMAGE_MIME_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

/** Windows Explorer often leaves `file.type` empty on drag — fall back to extension. */
export function isImageFile(file: File): boolean {
    if (file.type) {
        return IMAGE_MIME_TYPES.has(file.type);
    }

    return IMAGE_EXTENSION_PATTERN.test(file.name);
}
