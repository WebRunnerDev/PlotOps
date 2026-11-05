/** SessionStorage key for an in-flight OAuth consent return URL. */
export const PENDING_OAUTH_CONSENT_KEY = "plotops_pending_oauth_consent";

const AUTHORIZATION_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOAuthConsentRedirect(path: null | string): boolean {
    if (!path) return false;
    const pathname = path.split("?")[0] ?? "";
    return pathname === "/oauth/consent";
}

/** Supabase returns the OAuth client redirect after consent — http(s) only. */
export function isSafeHttpRedirect(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

export function oauthConsentHref(authorizationId: string): string {
    return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

export function parseAuthorizationId(raw: unknown): null | string {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!AUTHORIZATION_ID_PATTERN.test(trimmed)) return null;
    return trimmed;
}

/**
 * Same-origin path + query only. Used after sign-in to return to
 * `/oauth/consent?authorization_id=…` (and similar app paths).
 */
export function parseSafeAppRedirect(
    raw: null | string | undefined
): null | string {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 1024) return null;
    if (!trimmed.startsWith("/")) return null;
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
    if (trimmed.includes("://") || trimmed.includes("\\")) return null;
    if (trimmed.includes("#")) return null;

    try {
        const decoded = decodeURIComponent(trimmed);
        if (decoded.startsWith("//") || decoded.includes("://")) return null;
    } catch {
        return null;
    }

    return trimmed;
}
