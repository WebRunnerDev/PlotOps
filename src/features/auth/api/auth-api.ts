import type { AuthError } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";
import { safeGetItem } from "@/shared/lib/safe-storage";

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

export function getAuthErrorKey(error: AuthError): string {
    const code = error.code?.toLowerCase();
    if (code && AUTH_ERROR_CODE_KEYS[code]) {
        return AUTH_ERROR_CODE_KEYS[code];
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

export async function resendSignupConfirmation(email: string) {
    return supabase.auth.resend({
        email,
        options: {
            emailRedirectTo: signupEmailRedirectTo(),
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
    const pendingInvite = safeGetItem("sessionStorage", PENDING_INVITE_KEY);
    const redirectTo = pendingInvite
        ? `${globalThis.location.origin}/invite/${pendingInvite}`
        : `${globalThis.location.origin}/home`;

    return supabase.auth.signInWithOAuth({
        options: {
            redirectTo,
            scopes: "repo read:user",
        },
        provider: "github",
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
            emailRedirectTo: signupEmailRedirectTo(),
        },
        password: credentials.password,
    });
}

function signupEmailRedirectTo(): string {
    const origin = globalThis.location.origin;
    const pendingInvite = safeGetItem("sessionStorage", PENDING_INVITE_KEY);
    if (pendingInvite) {
        return `${origin}/invite/${pendingInvite}`;
    }
    return `${origin}/home`;
}
