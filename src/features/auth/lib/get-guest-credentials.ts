import { GUEST_DEMO_EMAIL } from "@/features/auth/lib/is-guest-session";

/** Well-known local demo password (see `supabase/seed.sql`). Not a production secret. */
export const GUEST_DEMO_LOCAL_PASSWORD = "plotops-demo-local" as const;

export type GuestCredentialEnvironment = {
    VITE_GUEST_EMAIL?: string;
    VITE_GUEST_PASSWORD?: string;
};

export type GuestCredentials = {
    email: string;
    password: string;
};

/**
 * Resolves demo guest sign-in credentials from Vite env, falling back to the
 * documented local seed identity when unset or blank.
 */
export function getGuestCredentials(
    environment: GuestCredentialEnvironment = import.meta
        .env as GuestCredentialEnvironment
): GuestCredentials {
    const email = environment.VITE_GUEST_EMAIL?.trim() || GUEST_DEMO_EMAIL;
    const password =
        environment.VITE_GUEST_PASSWORD || GUEST_DEMO_LOCAL_PASSWORD;

    return { email, password };
}
