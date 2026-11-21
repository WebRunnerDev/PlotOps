/** A whole `<script>` element; the end tag may carry whitespace (`</script >`). */
const SCRIPT_ELEMENT = /<script\b([^>]*)>[\s\S]*?<\/script\b[^>]*>/gi;

/** Scripts that stay: external (`src`) and JSON data blocks. */
const KEPT_SCRIPT_ATTRIBUTES =
    /\ssrc\s*=|\stype\s*=\s*["']?application\/(?:ld\+)?json\b/i;

/**
 * Removes inline executable `<script>` elements from prerendered app markup.
 *
 * TanStack Router's SSR emits a hydration bootstrap script (`self.$_TSR=…`).
 * The client mounts with `createRoot`, not `hydrateRoot`, so that payload is
 * never read — and CSP `script-src 'self'` (public/_headers) blocks it anyway.
 * The router cannot opt out here: `createRequestHandler` dehydrates before the
 * render callback runs, and `disableHydration()` is rejected after that.
 *
 * Replaces until stable so a removal cannot splice a new element together.
 */
export function stripInlineScripts(html: string): string {
    let previous: string;
    let current = html;

    do {
        previous = current;
        current = previous.replaceAll(
            SCRIPT_ELEMENT,
            (element, attributes: string) =>
                KEPT_SCRIPT_ATTRIBUTES.test(` ${attributes}`) ? element : ""
        );
    } while (current !== previous);

    return current;
}
