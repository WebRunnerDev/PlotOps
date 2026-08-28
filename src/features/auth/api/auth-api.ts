import type { AuthError, UserIdentity } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";
import { safeGetItem } from "@/shared/lib/safe-storage";

/** Shared with sign-in and Settings link — PlotOps needs repo + read:user for in-app Git. */
export const GITHUB_OAUTH_SCOPES = "repo read:user";

export type SignInCredentials = {
    email: string;
    password: string;
};

export type SignUpCredentials = SignInCredentials & {
    firstName: string;
    lastName: string;
};

const PENDING_INVITE_KEY = "plotops_pending_invite";

const AUTH_ERROR_CODE_KEYS: Record<string, string> = {
    email_exists: "errors.userAlreadyRegistered",
    email_not_confirmed: "errors.emailNotConfirmed",
    invalid_credentials: "errors.invalidCredentials",
    user_already_exists: "errors.userAlreadyRegistered",
    weak_password: "errors.weakPassword",
};

/** Statuses consulted when `code` is absent — before English message matching. */
const AUTH_ERROR_STATUS_KEYS: Record<number, string> = {
    429: "errors.generic",
};

export function getAuthErrorKey(error: AuthError): string {
    const code = error.code?.toLowerCase();
    if (code && AUTH_ERROR_CODE_KEYS[code]) {
        return AUTH_ERROR_CODE_KEYS[code];
    }

    if (error.status != undefined && AUTH_ERROR_STATUS_KEYS[error.status]) {
        return AUTH_ERROR_STATUS_KEYS[error.status];
    }

    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "errors.invalidCredentials";
    }
    if (message.includes("email not confirmed")) {
        return "errors.emailNotConfirmed";
    }
    if (message.includes("user already registered")) {
        return "errors.userAlreadyRegistered";
    }
    if (
        message.includes("password should be at least") ||
        message.includes("password is known to be weak") ||
        message.includes("weak password")
    ) {
        return "errors.weakPassword";
    }

    return "errors.generic";
}

const IDENTITY_ACTION_ERROR_CODE_KEYS: Record<string, string> = {
    identity_already_exists: "errors.identityAlreadyLinked",
    identity_not_found: "errors.identityAlreadyLinked",
    manual_linking_disabled: "errors.identityAlreadyLinked",
};

export function getIdentityActionErrorKey(error: AuthError): string {
    const code = error.code?.toLowerCase();
    if (code && IDENTITY_ACTION_ERROR_CODE_KEYS[code]) {
        return IDENTITY_ACTION_ERROR_CODE_KEYS[code];
    }

    const message = error.message.toLowerCase();

    if (
        message.includes("already linked") ||
        message.includes("identity is already linked") ||
        message.includes("identity already exists")
    ) {
        return "errors.identityAlreadyLinked";
    }
    if (
        message.includes("access_denied") ||
        message.includes("oauth flow was cancelled") ||
        (message.includes("oauth") && message.includes("cancel"))
    ) {
        return "errors.oauthCancelled";
    }
    if (
        message.includes("failed to fetch") ||
        message.includes("network error") ||
        message.includes("network request failed")
    ) {
        return "errors.networkFailure";
    }

    return getAuthErrorKey(error);
}

export async function linkIdentityWithGitHub() {
    return supabase.auth.linkIdentity({
        options: {
            redirectTo: settingsLinkRedirectTo(),
            scopes: GITHUB_OAUTH_SCOPES,
        },
        provider: "github",
    });
}

export async function linkIdentityWithGoogle() {
    return supabase.auth.linkIdentity({
        options: {
            redirectTo: settingsLinkRedirectTo(),
        },
        provider: "google",
    });
}

export async function resendSignupConfirmation(email: string) {
    return supabase.auth.resend({
        email,
        options: {
            emailRedirectTo: postAuthRedirectTo(),
        },
        type: "signup",
    });
}

export async function resetPasswordForEmail(email: string) {
    return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/sign-in`,
    });
}

export async function signInWithGitHub() {
    return supabase.auth.signInWithOAuth({
        options: {
            redirectTo: postAuthRedirectTo(),
            scopes: GITHUB_OAUTH_SCOPES,
        },
        provider: "github",
    });
}

export async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
        options: {
            redirectTo: postAuthRedirectTo(),
        },
        provider: "google",
    });
}

export async function signInWithPassword(credentials: SignInCredentials) {
    return supabase.auth.signInWithPassword(credentials);
}

export async function signOut() {
    return supabase.auth.signOut();
}

export async function signUpWithPassword(credentials: SignUpCredentials) {
    return supabase.auth.signUp({
        email: credentials.email,
        options: {
            data: {
                first_name: credentials.firstName.trim(),
                last_name: credentials.lastName.trim(),
            },
            emailRedirectTo: postAuthRedirectTo(),
        },
        password: credentials.password,
    });
}

export async function unlinkAuthIdentity(identity: UserIdentity) {
    return supabase.auth.unlinkIdentity(identity);
}

function postAuthRedirectTo(): string {
    const origin = globalThis.location.origin;
    const pendingInvite = safeGetItem("sessionStorage", PENDING_INVITE_KEY);
    if (pendingInvite) {
        return `${origin}/invite/${pendingInvite}`;
    }
    // Root URL matches Supabase `site_url` / redirect allow-list; `/` route
    // sends authenticated users to `/home` once Auth boot finishes.
    return `${origin}/`;
}

function settingsLinkRedirectTo(): string {
    return `${globalThis.location.origin}/settings`;
}
