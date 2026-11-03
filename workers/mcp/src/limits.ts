export const MAX_MCP_BODY_BYTES = 256 * 1024;
export const MAX_SEARCH_LENGTH = 200;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_LIST_LIMIT = 40;
export const MAX_TITLE_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 131_072;
export const MAX_COMMENT_LENGTH = 32_768;

export function clampLimit(raw: number | undefined): number {
    if (raw == undefined || !Number.isFinite(raw)) return DEFAULT_LIST_LIMIT;
    return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.trunc(raw)));
}

export function clampOffset(raw: number | undefined): number {
    if (raw == undefined || !Number.isFinite(raw)) return 0;
    return Math.min(10_000, Math.max(0, Math.trunc(raw)));
}

export function utf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}
