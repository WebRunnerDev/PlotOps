export type ProfileGateInput = {
    isGuest: boolean;
    profileNamesComplete: boolean;
};

/**
 * Whether authenticated users must finish `/complete-profile` (ADR 0015).
 * Guests skip the gate — the seed profile may regenerate incompletely after
 * auth edge cases, and the demo must reach the Board without friction.
 */
export function isProfileGateRequired({
    isGuest,
    profileNamesComplete,
}: ProfileGateInput): boolean {
    if (isGuest) {
        return false;
    }
    return !profileNamesComplete;
}
