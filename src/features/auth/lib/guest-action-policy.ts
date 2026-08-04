export type GuestActionPolicy = {
    canCreateInvite: boolean;
    canDeleteProject: boolean;
    canDeleteTeam: boolean;
};

/**
 * Destructive / multiplayer guest actions on the shared demo account.
 * `true` means the policy does not block — role caps still apply.
 */
export function guestActionPolicy(isGuest: boolean): GuestActionPolicy {
    const allowed = !isGuest;
    return {
        canCreateInvite: allowed,
        canDeleteProject: allowed,
        canDeleteTeam: allowed,
    };
}
