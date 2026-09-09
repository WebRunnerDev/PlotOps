/**
 * Pre-React SSG mask for returning Auth sessions.
 *
 * Cloudflare serves prerendered `/` (LoginForm) for the landing route. With a
 * live Supabase token in localStorage, that HTML paints before Auth boot —
 * users briefly see sign-in, then BootScreen, then the app. Authenticated SPA
 * paths fall back to `404.html` (empty `#root`, default title). An early head
 * script in `index.html` sets `data-plotops-auth-session` when a default
 * Supabase Auth storage key is present; BootScreen clears it on mount.
 */

export const PLOTOPS_AUTH_SESSION_HTML_ATTR = "data-plotops-auth-session";
export const PLOTOPS_SSG_AUTH_MASK_ID = "plotops-ssg-auth-mask";

/** Default GoTrue localStorage key: `sb-<project-ref>-auth-token`. */
export const SUPABASE_AUTH_TOKEN_STORAGE_KEY = /^sb-[a-z0-9]+-auth-token$/i;

/** Remove the static mask once React BootScreen owns the viewport. */
export function clearSsgAuthSessionMask(
    document_: Pick<Document, "documentElement" | "querySelector"> = document
): void {
    document_.documentElement.removeAttribute(PLOTOPS_AUTH_SESSION_HTML_ATTR);
    document_.querySelector(`#${PLOTOPS_SSG_AUTH_MASK_ID}`)?.remove();
}

export function hasPersistedSupabaseAuthSession(
    storage: Pick<Storage, "getItem" | "key" | "length">
): boolean {
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !SUPABASE_AUTH_TOKEN_STORAGE_KEY.test(key)) continue;
        if (storage.getItem(key)) return true;
    }
    return false;
}
