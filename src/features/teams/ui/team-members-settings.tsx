import { Copy, Link2, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { guestActionPolicy, useAuth } from "@/features/auth";
import { formatProfileDisplayName } from "@/features/auth/lib/user-display";
import { isGuest } from "@/features/guest-mode";
import {
    INVITE_TTL_OPTIONS,
    type InviteTtlValue,
    MEMBER_ROLES,
    type ProjectMemberRole,
} from "@/features/projects/model/access";
import { inviteUrl } from "@/features/teams/api/team-members-api";
import {
    actorFromAccess,
    canConfirmClaimedInvite,
    canEditExistingMemberRole,
    canInviteWithRole,
    canLeaveTeam,
    canRemoveMember,
    canTransferOwnership,
} from "@/features/teams/model/member-actions";
import { useTeamAccess } from "@/features/teams/model/use-team-access";
import {
    useConfirmTeamInvite,
    useCreateTeamInvite,
    useRemoveTeamMember,
    useRevokeTeamInvite,
    useTeam,
    useTeamInvites,
    useTeamMembers,
    useTeamOwnerProfile,
    useTransferTeamOwnership,
    useUpdateTeamMemberRole,
} from "@/features/teams/model/use-team-members";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Input } from "@/shared/shadcn/ui/input";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/shadcn/ui/select";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TeamMembersSettingsProperties = {
    teamId: string;
};

const AVATAR_TONES = [
    "bg-teal-600 text-white",
    "bg-violet-600 text-white",
    "bg-emerald-600 text-white",
    "bg-sky-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-black",
] as const;

export function TeamMembersSettings({ teamId }: TeamMembersSettingsProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const access = useTeamAccess(teamId);
    const actor = actorFromAccess(access);
    const guest = isGuest();
    const canCreateInvite = guestActionPolicy(guest).canCreateInvite;
    const { data: team } = useTeam(teamId);
    const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);
    const { data: ownerProfile } = useTeamOwnerProfile(team?.owner_id);
    const { data: invites, isLoading: invitesLoading } = useTeamInvites(
        teamId,
        access.canManageMembers && !guest
    );

    const createInvite = useCreateTeamInvite(teamId);
    const revokeInvite = useRevokeTeamInvite(teamId);
    const confirmInvite = useConfirmTeamInvite(teamId);
    const updateRole = useUpdateTeamMemberRole(teamId);
    const removeMember = useRemoveTeamMember(teamId);
    const transferOwnership = useTransferTeamOwnership(teamId);

    const [email, setEmail] = useState("");
    const [role, setRole] = useState<ProjectMemberRole>("contributor");
    const [ttl, setTtl] = useState<InviteTtlValue>("7");
    const [lastInviteToken, setLastInviteToken] = useState<null | string>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const invitableRoles = useMemo(() => {
        if (!actor) return [] as ProjectMemberRole[];
        return MEMBER_ROLES.filter((item) => canInviteWithRole(actor, item));
    }, [actor]);

    const query = searchQuery.trim().toLowerCase();

    const pendingInvites = useMemo(() => {
        const pending = (invites ?? []).filter(
            (invite) => invite.status === "pending"
        );
        if (!query) return pending;
        return pending.filter((invite) =>
            invite.email.toLowerCase().includes(query)
        );
    }, [invites, query]);

    const pendingInvitesTotal = useMemo(
        () =>
            (invites ?? []).filter((invite) => invite.status === "pending")
                .length,
        [invites]
    );

    const showOwner =
        Boolean(team && ownerProfile) &&
        (!query ||
            [
                ownerProfile?.username,
                ownerProfile?.first_name,
                ownerProfile?.last_name,
                formatProfileDisplayName(ownerProfile ?? {}),
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query)));

    const filteredMembers = useMemo(() => {
        const list = members ?? [];
        if (!query) return list;
        return list.filter((member) => {
            const profile = member.profile;
            if (!profile) return false;
            return [
                profile.username,
                profile.first_name,
                profile.last_name,
                formatProfileDisplayName(profile),
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [members, query]);

    const peopleCount = (team && ownerProfile ? 1 : 0) + (members?.length ?? 0);
    const visiblePeopleCount = (showOwner ? 1 : 0) + filteredMembers.length;

    if (access.isLoading) {
        return null;
    }

    if (access.isError) {
        return null;
    }

    if (!access.canManageMembers && !access.canView) {
        return null;
    }

    const copyInviteLink = async (token: string) => {
        try {
            await navigator.clipboard.writeText(inviteUrl(token));
            toast.success(t("members.linkCopied"));
        } catch {
            toast.error(t("members.copyFailed"));
        }
    };

    const onCreateInvite = async () => {
        if (!canCreateInvite) return;
        const trimmed = email.trim();
        if (!trimmed) return;
        try {
            const invite = await createInvite.mutateAsync({
                email: trimmed,
                role,
                ttl,
            });
            if (!invite) throw new Error("Invite create returned empty");
            setEmail("");
            setLastInviteToken(invite.token);
            await copyInviteLink(invite.token);
            toast.success(t("members.inviteCreated"));
        } catch {
            toast.error(t("members.inviteFailed"));
        }
    };

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-h3">{t("members.title")}</h2>
                <p className="text-ui text-muted-foreground">
                    {t("members.description")}
                </p>
                {guest ? (
                    <p className="text-ui text-muted-foreground">
                        {t("members.guestDemoNotice")}
                    </p>
                ) : undefined}
            </div>

            <div className="relative max-w-sm">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    className="pl-8"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("members.searchPlaceholder")}
                    value={searchQuery}
                />
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-meta tracking-wide text-muted-foreground uppercase">
                    {query
                        ? t("members.peopleFilteredCount", {
                              count: visiblePeopleCount,
                              total: peopleCount,
                          })
                        : t("members.peopleCount", { count: peopleCount })}
                </h3>
                {membersLoading ? (
                    <Spinner className="size-5 text-primary" />
                ) : visiblePeopleCount === 0 ? (
                    <p className="text-ui text-muted-foreground">
                        {t("members.noSearchMatches")}
                    </p>
                ) : (
                    <ul className="divide-y divide-border border border-border bg-card">
                        {showOwner && team && ownerProfile ? (
                            <li className="flex items-center gap-3 px-3.5 py-2">
                                <Avatar className="size-8 rounded-md">
                                    {ownerProfile.avatar_url ? (
                                        <AvatarImage
                                            alt=""
                                            src={ownerProfile.avatar_url}
                                        />
                                    ) : undefined}
                                    <AvatarFallback
                                        className={cn(
                                            "rounded-md text-meta",
                                            avatarTone(
                                                formatProfileDisplayName(
                                                    ownerProfile
                                                ) || "OW"
                                            )
                                        )}
                                    >
                                        {initials(
                                            formatProfileDisplayName(
                                                ownerProfile
                                            ) || "OW"
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-ui">
                                        {formatProfileDisplayName(
                                            ownerProfile
                                        ) || t("members.unknownUser")}
                                        {user?.id === team.owner_id || guest
                                            ? ` (${t("members.you")})`
                                            : ""}
                                    </p>
                                </div>
                                <RoleBadge role="owner" />
                            </li>
                        ) : undefined}
                        {filteredMembers.map((member) => {
                            const name =
                                (member.profile
                                    ? formatProfileDisplayName(member.profile)
                                    : "") || t("members.unknownUser");
                            const canEditRole =
                                Boolean(actor) &&
                                member.user_id !== user?.id &&
                                canEditExistingMemberRole(actor!, member.role);
                            const canRemove =
                                Boolean(actor) &&
                                member.user_id !== user?.id &&
                                canRemoveMember(actor!, member.role);
                            const canLeave =
                                member.user_id === user?.id &&
                                Boolean(actor) &&
                                canLeaveTeam(actor!);
                            const canMakeOwner =
                                Boolean(actor) &&
                                canTransferOwnership(actor!) &&
                                member.user_id !== user?.id;

                            return (
                                <li
                                    className="flex flex-wrap items-center gap-3 px-3.5 py-2"
                                    key={member.user_id}
                                >
                                    <Avatar className="size-8 rounded-md">
                                        {member.profile?.avatar_url ? (
                                            <AvatarImage
                                                alt=""
                                                src={member.profile.avatar_url}
                                            />
                                        ) : undefined}
                                        <AvatarFallback
                                            className={cn(
                                                "rounded-md text-meta",
                                                avatarTone(name)
                                            )}
                                        >
                                            {initials(name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-ui">
                                            {name}
                                            {member.user_id === user?.id
                                                ? ` (${t("members.you")})`
                                                : ""}
                                        </p>
                                    </div>
                                    <RoleBadge role={member.role} />
                                    {canEditRole ? (
                                        <Select
                                            onValueChange={(value) => {
                                                if (!value) return;
                                                void updateRole
                                                    .mutateAsync({
                                                        role: value as ProjectMemberRole,
                                                        userId: member.user_id,
                                                    })
                                                    .then(() =>
                                                        toast.success(
                                                            t(
                                                                "members.roleUpdated"
                                                            )
                                                        )
                                                    )
                                                    .catch(() =>
                                                        toast.error(
                                                            t(
                                                                "members.roleUpdateFailed"
                                                            )
                                                        )
                                                    );
                                            }}
                                            value={member.role}
                                        >
                                            <SelectTrigger className="h-8 w-36">
                                                <SelectValue>
                                                    {(value) =>
                                                        typeof value ===
                                                        "string"
                                                            ? value
                                                            : null
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {invitableRoles.map((item) => (
                                                    <SelectItem
                                                        key={item}
                                                        value={item}
                                                    >
                                                        {item}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : undefined}
                                    {canRemove ? (
                                        <Button
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                void removeMember
                                                    .mutateAsync(member.user_id)
                                                    .then(() =>
                                                        toast.success(
                                                            t("members.removed")
                                                        )
                                                    )
                                                    .catch(() =>
                                                        toast.error(
                                                            t(
                                                                "members.removeFailed"
                                                            )
                                                        )
                                                    );
                                            }}
                                            type="button"
                                            variant="outline"
                                        >
                                            {t("members.remove")}
                                        </Button>
                                    ) : undefined}
                                    {canMakeOwner ? (
                                        <Button
                                            disabled={
                                                transferOwnership.isPending
                                            }
                                            onClick={() => {
                                                void transferOwnership
                                                    .mutateAsync(member.user_id)
                                                    .then(() =>
                                                        toast.success(
                                                            t(
                                                                "members.ownershipTransferred"
                                                            )
                                                        )
                                                    )
                                                    .catch(() =>
                                                        toast.error(
                                                            t(
                                                                "members.transferFailed"
                                                            )
                                                        )
                                                    );
                                            }}
                                            type="button"
                                            variant="outline"
                                        >
                                            {t("members.makeOwner")}
                                        </Button>
                                    ) : undefined}
                                    {canLeave ? (
                                        <Button
                                            onClick={() => {
                                                void removeMember
                                                    .mutateAsync(member.user_id)
                                                    .then(() =>
                                                        toast.success(
                                                            t("members.left")
                                                        )
                                                    )
                                                    .catch(() =>
                                                        toast.error(
                                                            t(
                                                                "members.leaveFailed"
                                                            )
                                                        )
                                                    );
                                            }}
                                            type="button"
                                            variant="outline"
                                        >
                                            {t("members.leave")}
                                        </Button>
                                    ) : undefined}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {access.canManageMembers ? (
                <>
                    {guest ? undefined : (
                        <div className="flex flex-col gap-3">
                            <h3 className="text-meta tracking-wide text-muted-foreground uppercase">
                                {query
                                    ? t("members.pendingInvitesFilteredCount", {
                                          count: pendingInvites.length,
                                          total: pendingInvitesTotal,
                                      })
                                    : t("members.pendingInvitesCount", {
                                          count: pendingInvitesTotal,
                                      })}
                            </h3>
                            {invitesLoading ? (
                                <Spinner className="size-5 text-primary" />
                            ) : pendingInvitesTotal === 0 ? (
                                <p className="text-ui text-muted-foreground">
                                    {t("members.noPending")}
                                </p>
                            ) : pendingInvites.length === 0 ? (
                                <p className="text-ui text-muted-foreground">
                                    {t("members.noSearchMatches")}
                                </p>
                            ) : (
                                <ul className="divide-y divide-border border border-border bg-card">
                                    {pendingInvites.map((invite) => (
                                        <li
                                            className="flex flex-col gap-2 px-3.5 py-2 sm:flex-row sm:items-center"
                                            key={invite.id}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-ui">
                                                    {invite.email}
                                                </p>
                                                <p className="text-meta text-muted-foreground">
                                                    {invite.role}
                                                    {" · "}
                                                    {formatExpiresAt(
                                                        invite.expires_at,
                                                        t
                                                    )}
                                                    {invite.claimed_profile ? (
                                                        <span className="text-amber-500">
                                                            {" · "}
                                                            {t(
                                                                "members.claimedBy",
                                                                {
                                                                    name:
                                                                        (invite.claimed_profile
                                                                            ? formatProfileDisplayName(
                                                                                  invite.claimed_profile
                                                                              )
                                                                            : "") ||
                                                                        t(
                                                                            "members.unknownUser"
                                                                        ),
                                                                }
                                                            )}
                                                        </span>
                                                    ) : undefined}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    onClick={() =>
                                                        void copyInviteLink(
                                                            invite.token
                                                        )
                                                    }
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    <Copy data-icon="inline-start" />
                                                    {t("members.copyLink")}
                                                </Button>
                                                {invite.claimed_by &&
                                                actor &&
                                                canConfirmClaimedInvite(
                                                    actor,
                                                    invite.role
                                                ) ? (
                                                    <Button
                                                        disabled={
                                                            confirmInvite.isPending
                                                        }
                                                        onClick={() => {
                                                            void confirmInvite
                                                                .mutateAsync({
                                                                    inviteId:
                                                                        invite.id,
                                                                    userId: invite.claimed_by!,
                                                                })
                                                                .then(() =>
                                                                    toast.success(
                                                                        t(
                                                                            "members.confirmed"
                                                                        )
                                                                    )
                                                                )
                                                                .catch(() =>
                                                                    toast.error(
                                                                        t(
                                                                            "members.confirmFailed"
                                                                        )
                                                                    )
                                                                );
                                                        }}
                                                        size="sm"
                                                        type="button"
                                                    >
                                                        {t("members.confirm")}
                                                    </Button>
                                                ) : undefined}
                                                <Button
                                                    className="text-muted-foreground hover:text-destructive"
                                                    disabled={
                                                        revokeInvite.isPending
                                                    }
                                                    onClick={() => {
                                                        void revokeInvite
                                                            .mutateAsync(
                                                                invite.id
                                                            )
                                                            .then(() =>
                                                                toast.success(
                                                                    t(
                                                                        "members.revoked"
                                                                    )
                                                                )
                                                            )
                                                            .catch(() =>
                                                                toast.error(
                                                                    t(
                                                                        "members.revokeFailed"
                                                                    )
                                                                )
                                                            );
                                                    }}
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    {t("members.revoke")}
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {canCreateInvite ? (
                        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <UserPlus className="size-4 text-muted-foreground" />
                                <h3 className="text-ui font-medium">
                                    {t("members.inviteTitle")}
                                </h3>
                            </div>
                            <p className="text-ui text-muted-foreground">
                                {t("members.inviteHint")}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <Label htmlFor="invite-email">
                                        {t("members.email")}
                                    </Label>
                                    <Input
                                        autoComplete="email"
                                        id="invite-email"
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        placeholder={t(
                                            "members.emailPlaceholder"
                                        )}
                                        type="email"
                                        value={email}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t("members.role")}</Label>
                                    <Select
                                        onValueChange={(value) => {
                                            if (value)
                                                setRole(
                                                    value as ProjectMemberRole
                                                );
                                        }}
                                        value={role}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue>
                                                {(value) =>
                                                    typeof value === "string"
                                                        ? roleLabel(value, t)
                                                        : null
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {invitableRoles.map((item) => (
                                                <SelectItem
                                                    key={item}
                                                    value={item}
                                                >
                                                    {roleLabel(item, t)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t("members.ttl")}</Label>
                                    <Select
                                        onValueChange={(value) => {
                                            if (value)
                                                setTtl(value as InviteTtlValue);
                                        }}
                                        value={ttl}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue>
                                                {(value) =>
                                                    typeof value === "string"
                                                        ? t(
                                                              `members.ttlOptions.${value}`
                                                          )
                                                        : null
                                                }
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INVITE_TTL_OPTIONS.map((item) => (
                                                <SelectItem
                                                    key={item.value}
                                                    value={item.value}
                                                >
                                                    {t(
                                                        `members.ttlOptions.${item.value}`
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    disabled={
                                        createInvite.isPending || !email.trim()
                                    }
                                    onClick={() => void onCreateInvite()}
                                    type="button"
                                >
                                    {createInvite.isPending ? (
                                        <Spinner className="size-4" />
                                    ) : (
                                        <Link2 data-icon="inline-start" />
                                    )}
                                    {t("members.createInvite")}
                                </Button>
                                {lastInviteToken ? (
                                    <Button
                                        onClick={() =>
                                            void copyInviteLink(lastInviteToken)
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <Copy data-icon="inline-start" />
                                        {t("members.copyLink")}
                                    </Button>
                                ) : undefined}
                            </div>
                        </div>
                    ) : guest ? (
                        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
                            <div className="flex items-center gap-2">
                                <UserPlus className="size-4 text-muted-foreground" />
                                <h3 className="text-ui font-medium">
                                    {t("members.inviteTitle")}
                                </h3>
                            </div>
                            <p className="text-ui text-muted-foreground">
                                {t("members.guestInviteUnavailable")}
                            </p>
                        </div>
                    ) : undefined}
                </>
            ) : undefined}
        </section>
    );
}

function avatarTone(seed: string) {
    let hash = 0;
    for (const char of seed) {
        hash = (hash + char.codePointAt(0)!) % AVATAR_TONES.length;
    }
    return AVATAR_TONES[hash] ?? AVATAR_TONES[0];
}

function formatExpiresAt(
    expiresAt: null | string,
    t: (key: string, options?: Record<string, unknown>) => string
) {
    if (!expiresAt) return t("members.expiresNever");
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return t("members.expiresSoon");
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (days <= 1) return t("members.expiresInDays", { count: 1 });
    return t("members.expiresInDays", { count: days });
}

function initials(name: string) {
    return name.slice(0, 2).toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
    return (
        <Badge className={roleBadgeClass(role)} variant="outline">
            {role}
        </Badge>
    );
}

/** Outline badges as in Figma — uppercase role key, colored border + text. */
function roleBadgeClass(role: string) {
    switch (role) {
        case "admin": {
            return "border-fuchsia-500/70 bg-transparent font-mono text-xs tracking-wide text-fuchsia-400 uppercase";
        }
        case "contributor": {
            return "border-sky-500/70 bg-transparent font-mono text-xs tracking-wide text-sky-400 uppercase";
        }
        case "manager": {
            return "border-orange-500/70 bg-transparent font-mono text-xs tracking-wide text-orange-400 uppercase";
        }
        case "owner": {
            return "border-amber-500/70 bg-transparent font-mono text-xs tracking-wide text-amber-400 uppercase";
        }
        default: {
            return "border-border bg-transparent font-mono text-xs tracking-wide text-muted-foreground uppercase";
        }
    }
}

function roleLabel(role: string, t: (key: string) => string) {
    return t(`members.roles.${role}`);
}
