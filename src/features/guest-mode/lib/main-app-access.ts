import { isGuest } from "./guest-session";

/**
 * Main app chrome requires a real Auth session or a Guest Session.
 * Modes must not mix — AuthProvider clears Guest when a real user appears.
 */
export function hasMainAppAccess(hasAuthUser: boolean): boolean {
    return hasAuthUser || isGuest();
}
