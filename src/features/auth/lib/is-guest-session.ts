/**
 * Well-known local demo guest identity (see `supabase/seed.sql`).
 * Shared across concurrent guest sessions — acceptable for portfolio demos.
 */
export const GUEST_DEMO_USER_ID =
    "a0000000-0000-4000-8000-000000000001" as const;

export const GUEST_DEMO_EMAIL = "demo@plotops.app" as const;

export type GuestSessionUser = {
    email?: null | string;
    id?: null | string;
};

/** True when the signed-in user is the shared demo guest account. */
export function isGuestSession(
    user: GuestSessionUser | null | undefined
): boolean {
    if (!user) {
        return false;
    }

    if (user.id === GUEST_DEMO_USER_ID) {
        return true;
    }

    const email = user.email?.trim().toLowerCase();
    if (email && email === GUEST_DEMO_EMAIL) {
        return true;
    }

    return false;
}
