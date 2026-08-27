/**
 * Whether a controlled `value` should be pushed into TipTap via `setContent`.
 *
 * While image uploads are in flight, `onChange` is deferred so the parent still
 * holds pre-upload HTML. Re-applying that stale value wipes the placeholder and
 * the in-flight upload can no longer find its `uploadId` — the image vanishes.
 */
export function shouldApplyExternalContent(input: {
    currentHtml: string;
    nextHtml: string;
    pendingUploads: number;
}): boolean {
    if (input.pendingUploads > 0) return false;
    return input.currentHtml !== input.nextHtml;
}
