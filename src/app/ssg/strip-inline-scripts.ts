/**
 * Removes inline executable `<script>` elements from prerendered app markup.
 *
 * TanStack Router's SSR emits a hydration bootstrap script (`self.$_TSR=…`).
 * The client mounts with `createRoot`, not `hydrateRoot`, so that payload is
 * never read — and CSP `script-src 'self'` (public/_headers) blocks it anyway.
 * Scripts with a `src`, and JSON data blocks, are kept.
 */
export function stripInlineScripts(html: string): string {
    return html.replaceAll(
        /<script\b([^>]*)>[\s\S]*?<\/script>/gi,
        (tag, attributes: string) =>
            /\ssrc=|type=["']application\/(?:ld\+)?json["']/i.test(
                ` ${attributes}`
            )
                ? tag
                : ""
    );
}
