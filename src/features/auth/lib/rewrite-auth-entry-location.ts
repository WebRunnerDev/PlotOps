import {
    isOAuthConsentRedirect,
    parseSafeAppRedirect,
} from "./safe-app-redirect";

/**
 * Before RouterProvider's first `load()`, move authenticated entry URLs off
 * `/` and `/sign-in` so LoginForm is never the first matched route.
 *
 * Auth boot can leave `auth.user` set while the URL is still `/` (site_url /
 * OAuth return). Without this rewrite, the sign-in shell can paint for a
 * frame (especially on Vite, where there is no SSG mask).
 */
export function resolvePostBootEntryHref(input: {
    hash: string;
    hasUser: boolean;
    pathname: string;
    pendingConsentPath?: null | string;
    pendingInviteToken?: null | string;
    search: string;
}): null | string {
    if (!input.hasUser) return null;

    const path = input.pathname;
    if (path !== "/" && path !== "/sign-in") return null;

    const token = input.pendingInviteToken?.trim();
    if (token) {
        return `/invite/${encodeURIComponent(token)}`;
    }

    const pendingConsent = parseSafeAppRedirect(input.pendingConsentPath);
    if (pendingConsent && isOAuthConsentRedirect(pendingConsent)) {
        return pendingConsent;
    }

    const redirectParameter = new URLSearchParams(input.search).get("redirect");
    const safeRedirect = parseSafeAppRedirect(redirectParameter);
    if (safeRedirect) {
        return safeRedirect;
    }

    return `/home${input.search}${input.hash}`;
}

export function rewriteAuthEntryLocation(input: {
    hasUser: boolean;
    history?: Pick<History, "replaceState" | "state">;
    location?: Pick<Location, "hash" | "pathname" | "search">;
    pendingConsentPath?: null | string;
    pendingInviteToken?: null | string;
}): boolean {
    const location_ = input.location ?? globalThis.location;
    const history_ = input.history ?? globalThis.history;
    if (!location_ || !history_) return false;

    const href = resolvePostBootEntryHref({
        hash: location_.hash,
        hasUser: input.hasUser,
        pathname: location_.pathname,
        pendingConsentPath: input.pendingConsentPath,
        pendingInviteToken: input.pendingInviteToken,
        search: location_.search,
    });
    if (!href) return false;

    history_.replaceState(history_.state, "", href);
    return true;
}
