export const teamKeys = {
    all: ["teams"] as const,
    detail: (teamId: string) => [...teamKeys.all, "detail", teamId] as const,
    invites: (teamId: string) =>
        [...teamKeys.detail(teamId), "invites"] as const,
    members: (teamId: string) =>
        [...teamKeys.detail(teamId), "members"] as const,
    myMembership: (teamId: string, userId: string | undefined) =>
        [...teamKeys.detail(teamId), "my-membership", userId] as const,
};
