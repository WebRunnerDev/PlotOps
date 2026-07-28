import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

/** Current Project Owner + Members (including Viewer) for Mention picker. */
export function useProjectPeople(projectId: string): ProjectPerson[] {
    const { t } = useTranslation("board");
    const { data: project } = useProject(projectId);
    const { data: members = [] } = useProjectMembers(projectId);
    const { data: ownerProfile } = useProjectOwnerProfile(project?.owner_id);

    return useMemo(() => {
        const byId = new Map<string, ProjectPerson>();

        if (ownerProfile) {
            byId.set(ownerProfile.id, {
                avatarUrl: ownerProfile.avatar_url ?? undefined,
                id: ownerProfile.id,
                name: ownerProfile.username ?? t("members.unknownUser"),
            });
        }

        for (const member of members) {
            if (!member.profile) continue;
            byId.set(member.user_id, {
                avatarUrl: member.profile.avatar_url ?? undefined,
                id: member.user_id,
                name: member.profile.username ?? t("members.unknownUser"),
            });
        }

        return [...byId.values()].toSorted((left, right) =>
            left.name.localeCompare(right.name)
        );
    }, [members, ownerProfile, t]);
}
