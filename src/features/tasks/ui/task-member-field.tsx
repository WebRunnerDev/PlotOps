import { User } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { TaskAssignee } from "@/features/tasks/model/types";

import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/shared/shadcn/ui/combobox";
import { InputGroupAddon } from "@/shared/shadcn/ui/input-group";

export type TaskMemberOption = TaskAssignee;

const NONE_ID = "__none__";

type TaskMemberFieldProperties = {
    disabled?: boolean;
    id: string;
    onChange: (value: null | TaskMemberOption) => void;
    projectId: string;
    value: TaskMemberOption | undefined;
};

/** Next assignee for the field, or `undefined` when the selection is a no-op. */
export function resolveMemberFieldChange(input: {
    currentId: null | string;
    next: null | TaskMemberOption | undefined;
}): null | TaskMemberOption | undefined {
    const nextId =
        !input.next || input.next.id === NONE_ID ? null : input.next.id;
    if (nextId === input.currentId) {
        return undefined;
    }
    if (nextId === null) {
        return null;
    }
    return input.next ?? null;
}

export function TaskMemberField({
    disabled = false,
    id,
    onChange,
    projectId,
    value,
}: TaskMemberFieldProperties) {
    const { t } = useTranslation("board");
    const people = useProjectPeople(projectId);

    const noneOption: TaskMemberOption = useMemo(
        () => ({
            id: NONE_ID,
            name: t("fields.memberNone"),
        }),
        [t]
    );

    const items = useMemo(() => [noneOption, ...people], [noneOption, people]);

    const selected =
        value === undefined
            ? noneOption
            : (people.find((person) => person.id === value.id) ?? value);

    return (
        <Combobox
            disabled={disabled}
            isItemEqualToValue={isSameMemberId}
            items={items}
            itemToStringLabel={memberToLabel}
            onValueChange={(next) => {
                const resolved = resolveMemberFieldChange({
                    currentId: value?.id ?? null,
                    next,
                });
                if (resolved === undefined) {
                    return;
                }
                onChange(resolved);
            }}
            value={selected}
        >
            <ComboboxInput
                className="w-full rounded-none font-mono text-code"
                disabled={disabled}
                id={id}
            >
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

function initials(name: string) {
    const parts = name
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function isSameMemberId(
    left: TaskMemberOption,
    right: TaskMemberOption
): boolean {
    return left.id === right.id;
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
                {member?.name ? (
                    initials(member.name)
                ) : (
                    <User className="size-3" />
                )}
            </AvatarFallback>
        </Avatar>
    );
}

function memberToLabel(item: TaskMemberOption): string {
    return item.name;
}
