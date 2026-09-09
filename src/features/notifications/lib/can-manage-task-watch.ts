import {
    capabilitiesForRole,
    type ProjectAccessRole,
} from "@/features/projects/model/access";

export function canManageTaskWatch(input: {
    actorRole: null | ProjectAccessRole;
    actorUserId: string;
    targetCanViewTask: boolean;
    targetUserId: string;
}): boolean {
    if (!input.targetCanViewTask || input.actorRole === null) {
        return false;
    }

    if (input.actorUserId === input.targetUserId) {
        return true;
    }

    return capabilitiesForRole(input.actorRole).canManageWatchers;
}
