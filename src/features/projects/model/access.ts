export type ProjectMemberRole =
    | "admin"
    | "contributor"
    | "manager"
    | "viewer";

export type ProjectAccessRole = "owner" | ProjectMemberRole;

export type ProjectCapabilities = {
    canCreateTasks: boolean;
    canDeleteProject: boolean;
    canDeleteTasks: boolean;
    canEditTasks: boolean;
    canGrantAdmin: boolean;
    canManageBoard: boolean;
    canManageMembers: boolean;
    canManageSettings: boolean;
    canView: boolean;
    role: null | ProjectAccessRole;
};

export function capabilitiesForRole(
    role: null | ProjectAccessRole,
): ProjectCapabilities {
    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isManager = role === "manager";
    const isContributor = role === "contributor";
    const isViewer = role === "viewer";

    const canManageBoard = isOwner || isAdmin || isManager;
    const canEditTasks = canManageBoard || isContributor;
    const canManageMembers = isOwner || isAdmin;

    return {
        canCreateTasks: canManageBoard,
        canDeleteProject: isOwner,
        canDeleteTasks: canManageBoard,
        canEditTasks,
        canGrantAdmin: isOwner,
        canManageBoard,
        canManageMembers,
        canManageSettings: canManageMembers,
        canView: isOwner || isAdmin || isManager || isContributor || isViewer,
        role,
    };
}

export const MEMBER_ROLES: ProjectMemberRole[] = [
    "admin",
    "manager",
    "contributor",
    "viewer",
];

export const INVITE_TTL_OPTIONS = [
    { days: 1, value: "1" },
    { days: 7, value: "7" },
    { days: 30, value: "30" },
    { days: null, value: "never" },
] as const;

export type InviteTtlValue = (typeof INVITE_TTL_OPTIONS)[number]["value"];

export function expiresAtFromTtl(ttl: InviteTtlValue): null | string {
    const option = INVITE_TTL_OPTIONS.find((item) => item.value === ttl);
    if (!option || option.days === null) return null;
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + option.days);
    return date.toISOString();
}
