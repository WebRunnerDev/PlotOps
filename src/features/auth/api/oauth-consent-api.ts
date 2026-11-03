import { supabase } from "@/shared/api/supabase";

export async function approveOAuthAuthorization(authorizationId: string) {
    return supabase.auth.oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
    });
}

export async function denyOAuthAuthorization(authorizationId: string) {
    return supabase.auth.oauth.denyAuthorization(authorizationId, {
        skipBrowserRedirect: true,
    });
}

export async function fetchOAuthAuthorizationDetails(authorizationId: string) {
    return supabase.auth.oauth.getAuthorizationDetails(authorizationId);
}

export function isOAuthAuthorizationDetails(
    data: unknown
): data is { authorization_id: string } {
    return Boolean(
        data &&
        typeof data === "object" &&
        "authorization_id" in data &&
        typeof data.authorization_id === "string"
    );
}

export function oauthRedirectUrl(data: unknown): null | string {
    if (!data || typeof data !== "object" || !("redirect_url" in data)) {
        return null;
    }
    return typeof data.redirect_url === "string" ? data.redirect_url : null;
}
