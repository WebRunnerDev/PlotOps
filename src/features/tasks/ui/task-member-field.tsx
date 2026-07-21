import { User } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TaskAssignee } from "@/features/tasks/model/types";
import { useProject } from "@/features/projects/model/use-projects";
import {
    useProjectMembers,
    useProjectOwnerProfile,
} from "@/features/projects/model/use-project-members";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/shadcn/ui/avatar";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";
import { InputGroupAddon } from "@/shared/shadcn/ui/input-group";
import { cn } from "@/shared/lib/utils";

export type TaskMemberOption = TaskAssignee;

const NONE_ID = "__none__";

type TaskMemberFieldProperties = {
    disabled?: boolean;
    id: string;
    onChange: (value: TaskMemberOption | null) => void;
    projectId: string;
    value: TaskMemberOption | undefined;
};

function initials(name: string) {
    const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function MemberAvatar({
    className,
    member,
}: {
    className?: string;
    member: TaskMemberOption | undefined;
}) {
    return (
        <Avatar className={cn("size-5 rounded-none", className)} size="sm">
            {member?.avatarUrl ? (
                <AvatarImage alt="" src={member.avatarUrl} />
            ) : undefined}
            <AvatarFallback className="rounded-none text-meta">
                {member?.name ? initials(member.name) : <User className="size-3" />}
            </AvatarFallback>
        </Avatar>
    );
}

export function TaskMemberField({
    disabled = false,
    id,
    onChange,
    projectId,
    value,
}: TaskMemberFieldProperties) {
    const { t } = useTranslation("board");
    const { data: project } = useProject(projectId);
    const { data: members = [] } = useProjectMembers(projectId);
    const { data: ownerProfile } = useProjectOwnerProfile(project?.owner_id);

    const people = useMemo(() => {
        const byId = new Map<string, TaskMemberOption>();

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

        return [...byId.values()].sort((left, right) =>
            left.name.localeCompare(right.name),
        );
    }, [members, ownerProfile, t]);

    const noneOption: TaskMemberOption = useMemo(
        () => ({
            id: NONE_ID,
            name: t("fields.memberNone"),
        }),
        [t],
    );

    const items = useMemo(() => [noneOption, ...people], [noneOption, people]);

    const selected =
        value === undefined
            ? noneOption
            : (people.find((person) => person.id === value.id) ?? value);

    return (
        <Combobox
            disabled={disabled}
            isItemEqualToValue={(left, right) => left.id === right.id}
            items={items}
            itemToStringLabel={(item) => item.name}
            onValueChange={(next) => {
                if (!next || next.id === NONE_ID) {
                    onChange(null);
                    return;
                }
                onChange(next);
            }}
            value={selected}
        >
            <ComboboxInput className="w-full" id={id}>
                {selected.id === NONE_ID ? undefined : (
                    <InputGroupAddon align="inline-start">
                        <MemberAvatar member={selected} />
                    </InputGroupAddon>
                )}
            </ComboboxInput>
            <ComboboxContent>
                <ComboboxEmpty>{t("fields.memberNoResults")}</ComboboxEmpty>
                <ComboboxList>
                    {(person: TaskMemberOption) => (
                        <ComboboxItem key={person.id} value={person}>
                            <span className="flex min-w-0 items-center gap-2">
                                {person.id === NONE_ID ? (
                                    <span className="flex size-5 items-center justify-center">
                                        <User className="size-3 text-muted-foreground" />
                                    </span>
                                ) : (
                                    <MemberAvatar member={person} />
                                )}
                                <span className="truncate">{person.name}</span>
                            </span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
