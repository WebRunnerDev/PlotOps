export type ProfileGateInput = {
    isGuest: boolean;
    profileNamesComplete: boolean;
};

/**
 * Whether authenticated users must finish `/complete-profile` (ADR 0015).
 * Guest Sessions have no Supabase user, so the gate does not apply (ADR 0018).
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
