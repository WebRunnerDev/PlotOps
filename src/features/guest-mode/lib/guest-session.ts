import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

/** Synthetic chrome identity for a Guest Session — not a Supabase user. */
export type GuestDisplayIdentity = {
    firstName: string;
    lastName: string;
    username: string;
};

/**
 * Internal sessionStorage key for the Guest Session signal.
 * Not part of the public guest-mode contract — do not assert in callers/tests.
 */
const GUEST_SESSION_STORAGE_KEY = "plotops_guest_session";

const SYNTHETIC_GUEST_IDENTITY: GuestDisplayIdentity = {
    firstName: "Demo",
    lastName: "Guest",
    username: "guest",
};

type StoredGuestSession = {
    identity: GuestDisplayIdentity;
    /** Reserved for the local sandbox; empty / no-op in this ticket. */
    sandbox: Record<string, never>;
};

export function getGuestDisplayIdentity(): GuestDisplayIdentity | null {
    return readSession()?.identity ?? null;
}

/** True when a Guest Session is active in this browser session. */
export function isGuest(): boolean {
    return readSession() !== null;
}

export function leaveGuestSession(): void {
    safeRemoveItem("sessionStorage", GUEST_SESSION_STORAGE_KEY);
}

/**
 * Restore a clean (empty) sandbox while staying in Guest Mode.
 * No-op when no Guest Session is active.
 */
export function resetGuestSession(): GuestDisplayIdentity | null {
    if (!isGuest()) {
        return null;
    }
    return persistSession(SYNTHETIC_GUEST_IDENTITY);
}

export function startGuestSession(): GuestDisplayIdentity {
    return persistSession(SYNTHETIC_GUEST_IDENTITY);
}

function isStoredGuestSession(value: unknown): value is StoredGuestSession {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    const identity = record.identity;
    if (!identity || typeof identity !== "object") {
        return false;
    }
    const id = identity as Record<string, unknown>;
    return (
        typeof id.firstName === "string" &&
        typeof id.lastName === "string" &&
        typeof id.username === "string"
    );
}

function persistSession(identity: GuestDisplayIdentity): GuestDisplayIdentity {
    const session: StoredGuestSession = {
        identity: { ...identity },
        sandbox: {},
    };
    safeSetItem(
        "sessionStorage",
        GUEST_SESSION_STORAGE_KEY,
        JSON.stringify(session)
    );
    return session.identity;
}

function readSession(): null | StoredGuestSession {
    const raw = safeGetItem("sessionStorage", GUEST_SESSION_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredGuestSession(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
