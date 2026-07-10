import type { AuthError } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";

export type SignInCredentials = {
    email: string;
    password: string;
};

export type SignUpCredentials = SignInCredentials;

export function getAuthErrorKey(error: AuthError): string {
    const message = error.message.toLowerCase();

    if (message.includes("invalid login credentials")) {
        return "errors.auth.invalid_credentials";
    }
    if (message.includes("email not confirmed")) {
        return "errors.auth.email_not_confirmed";
    }
    if (message.includes("user already registered")) {
        return "errors.auth.user_already_registered";
    }
    if (message.includes("password")) {
        return "errors.auth.weak_password";
    }

    return "errors.auth.generic";
}

export async function resetPasswordForEmail(email: string) {
    return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${globalThis.location.origin}/sign-in`,
    });
}

export async function signInWithGitHub() {
    return supabase.auth.signInWithOAuth({
        options: {
            redirectTo: `${globalThis.location.origin}/home`,
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
    return supabase.auth.signUp(credentials);
}
