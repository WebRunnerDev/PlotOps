/**
 * Board setting "Auto-assign tasks to me": new Tasks get the creator as
 * Assignee only when that Team has a single person (Owner, no Members).
 */

export function countTeamPeople(input: {
    hasOwner: boolean;
    memberCount: number;
}): number {
    return (input.hasOwner ? 1 : 0) + input.memberCount;
}

export function isSoloTeam(teamPeopleCount: number): boolean {
    return teamPeopleCount === 1;
}

export function shouldAutoAssignToCreator(input: {
    autoAssignToCreator: boolean;
    teamPeopleCount: number;
}): boolean {
    return input.autoAssignToCreator && isSoloTeam(input.teamPeopleCount);
}
