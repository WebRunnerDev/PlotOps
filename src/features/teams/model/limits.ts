import type { TeamRow } from "@/features/teams/api/team-members-api";

/** Max Teams one user may own — matches `teams_owned_cap()` (ADR 0032). */
export const TEAMS_OWNED_CAP = 3;

/** Max Teams one user may join — matches `team_memberships_cap()` (ADR 0032). */
export const TEAM_MEMBERSHIPS_CAP = 10;

export function canCreateTeam(teams: TeamRow[], userId: string): boolean {
    return countOwnedTeams(teams, userId) < TEAMS_OWNED_CAP;
}

export function canJoinTeam(teams: TeamRow[], userId: string): boolean {
    return countJoinedTeams(teams, userId) < TEAM_MEMBERSHIPS_CAP;
}

/** Teams the user joined as a Member — the complement of {@link countOwnedTeams}. */
export function countJoinedTeams(teams: TeamRow[], userId: string): number {
    return teams.filter((team) => team.owner_id !== userId).length;
}

/** Teams the user owns. Owner is `teams.owner_id`, never a `team_members` row. */
export function countOwnedTeams(teams: TeamRow[], userId: string): number {
    return teams.filter((team) => team.owner_id === userId).length;
}
