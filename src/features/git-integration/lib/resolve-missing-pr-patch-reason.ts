const BINARY_EXTENSIONS = new Set([
    "7z",
    "aac",
    "avi",
    "bin",
    "bmp",
    "class",
    "dll",
    "dmg",
    "doc",
    "docx",
    "eot",
    "exe",
    "flac",
    "gif",
    "gz",
    "ico",
    "jar",
    "jpeg",
    "jpg",
    "m4a",
    "mov",
    "mp3",
    "mp4",
    "odt",
    "ogg",
    "otf",
    "pdf",
    "png",
    "ppt",
    "pptx",
    "rar",
    "so",
    "tar",
    "tgz",
    "ttf",
    "wasm",
    "wav",
    "webm",
    "webp",
    "woff",
    "woff2",
    "xls",
    "xlsx",
    "zip",
]);

export type MissingPrPatchReason = "binary" | "too-large";

/**
 * GitHub omits `patch` for binary files and for diffs that exceed its size limit.
 * Heuristic: known binary extensions → binary; otherwise treat as too large.
 */
export function resolveMissingPrPatchReason(
    filename: string
): MissingPrPatchReason {
    const base = filename.split("/").pop() ?? filename;
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) {
        return "too-large";
    }
    const extension = base.slice(dot + 1).toLowerCase();
    return BINARY_EXTENSIONS.has(extension) ? "binary" : "too-large";
}
