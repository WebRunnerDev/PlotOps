import type { AuthError } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";

export type SignInCredentials = {
    email: string;
    password: string;
};

export type SignUpCredentials = SignInCredentials;

const PENDING_INVITE_KEY = "plotops_pending_invite";

export function getAuthErrorKey(error: AuthError): string {
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
    if (message.includes("password")) {
        return "errors.weakPassword";
    }

    return "errors.generic";
}

function signupEmailRedirectTo(): string {
    const origin = globalThis.location.origin;
    const pendingInvite = globalThis.sessionStorage?.getItem(PENDING_INVITE_KEY);
    if (pendingInvite) {
        return `${origin}/invite/${pendingInvite}`;
    }
    return `${origin}/home`;
}

export async function resetPasswordForEmail(email: string) {
    return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/sign-in`,
    });
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

export async function signInWithGitHub() {
    const pendingInvite = globalThis.sessionStorage?.getItem(PENDING_INVITE_KEY);
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
            emailRedirectTo: signupEmailRedirectTo(),
        },
        password: credentials.password,
    });
}
