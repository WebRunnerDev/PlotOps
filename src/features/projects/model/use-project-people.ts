import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { isGuest } from "@/features/guest-mode";
import { listGuestProjectPeople } from "@/features/projects/api/guest-project-people";
import {
    useProjectMembers,
    useProjectOwnerProfile,
} from "@/features/projects/model/use-project-members";
import { useProject } from "@/features/projects/model/use-projects";

export type ProjectPerson = {
    avatarUrl?: string;
    id: string;
    name: string;
};

const EMPTY_MEMBERS: never[] = [];
const EMPTY_PEOPLE: ProjectPerson[] = [];

/** Current Project Owner + Members (including Viewer) for Mention picker. */
export function useProjectPeople(projectId: string): ProjectPerson[] {
    const { t } = useTranslation("board");
    const guest = isGuest();
    const { data: project } = useProject(projectId);
    const { data: membersData } = useProjectMembers(projectId);
    const members = membersData ?? EMPTY_MEMBERS;
    const { data: ownerProfile } = useProjectOwnerProfile(
        guest ? undefined : project?.owner_id
    );

    const guestPeople = useMemo(
        () => (guest ? listGuestProjectPeople(projectId) : EMPTY_PEOPLE),
        [guest, projectId]
    );

    return useMemo(() => {
        if (guest) {
            return guestPeople;
        }

        const byId = new Map<string, ProjectPerson>();

        if (ownerProfile) {
            byId.set(ownerProfile.id, {
                avatarUrl: ownerProfile.avatar_url ?? undefined,
                id: ownerProfile.id,
                name:
                    formatProfileDisplayName(ownerProfile) ||
                    t("members.unknownUser"),
            });
        }

        for (const member of members) {
            if (!member.profile) continue;
            byId.set(member.user_id, {
                avatarUrl: member.profile.avatar_url ?? undefined,
                id: member.user_id,
                name:
                    formatProfileDisplayName(member.profile) ||
                    t("members.unknownUser"),
            });
        }

        return [...byId.values()].toSorted((left, right) =>
            left.name.localeCompare(right.name)
        );
    }, [guest, guestPeople, members, ownerProfile, t]);
}
