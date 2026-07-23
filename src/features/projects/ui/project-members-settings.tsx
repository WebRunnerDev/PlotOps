import { Copy, Link2, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/features/auth";
import { inviteUrl } from "@/features/projects/api/members-api";
import {
    INVITE_TTL_OPTIONS,
    type InviteTtlValue,
    MEMBER_ROLES,
    type ProjectMemberRole,
} from "@/features/projects/model/access";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    useConfirmProjectInvite,
    useCreateProjectInvite,
    useProjectInvites,
    useProjectMembers,
    useProjectOwnerProfile,
    useRemoveProjectMember,
    useRevokeProjectInvite,
    useUpdateMemberRole,
} from "@/features/projects/model/use-project-members";
import { useProject } from "@/features/projects/model/use-projects";
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

type ProjectMembersSettingsProperties = {
    projectId: string;
};

const AVATAR_TONES = [
    "bg-teal-600 text-white",
    "bg-violet-600 text-white",
    "bg-emerald-600 text-white",
    "bg-sky-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-black",
] as const;

export function ProjectMembersSettings({
    projectId,
}: ProjectMembersSettingsProperties) {
    const { t } = useTranslation("board");
    const { user } = useAuth();
    const access = useProjectAccess(projectId);
    const { data: project } = useProject(projectId);
    const { data: members, isLoading: membersLoading } =
        useProjectMembers(projectId);
    const { data: ownerProfile } = useProjectOwnerProfile(project?.owner_id);
    const { data: invites, isLoading: invitesLoading } = useProjectInvites(
        projectId,
        access.canManageMembers
    );

    const createInvite = useCreateProjectInvite(projectId);
    const revokeInvite = useRevokeProjectInvite(projectId);
    const confirmInvite = useConfirmProjectInvite(projectId);
    const updateRole = useUpdateMemberRole(projectId);
    const removeMember = useRemoveProjectMember(projectId);

    const [email, setEmail] = useState("");
    const [role, setRole] = useState<ProjectMemberRole>("contributor");
    const [ttl, setTtl] = useState<InviteTtlValue>("7");
    const [lastInviteToken, setLastInviteToken] = useState<null | string>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const invitableRoles = useMemo(() => {
        if (access.canGrantAdmin) return MEMBER_ROLES;
        return MEMBER_ROLES.filter((item) => item !== "admin");
    }, [access.canGrantAdmin]);

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
        Boolean(project && ownerProfile) &&
        (!query ||
            (ownerProfile?.username ?? "").toLowerCase().includes(query));

    const filteredMembers = useMemo(() => {
        const list = members ?? [];
        if (!query) return list;
        return list.filter((member) =>
            (member.profile?.username ?? "").toLowerCase().includes(query)
        );
    }, [members, query]);

    const peopleCount =
        (project && ownerProfile ? 1 : 0) + (members?.length ?? 0);
    const visiblePeopleCount = (showOwner ? 1 : 0) + filteredMembers.length;

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
                        {showOwner && project && ownerProfile ? (
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
                                                ownerProfile.username ?? "OW"
                                            )
                                        )}
                                    >
                                        {initials(
                                            ownerProfile.username ?? "OW"
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-ui">
                                        {ownerProfile.username ??
                                            t("members.unknownUser")}
                                        {user?.id === project.owner_id
                                            ? ` (${t("members.you")})`
                                            : ""}
                                    </p>
                                </div>
                                <RoleBadge role="owner" />
                            </li>
                        ) : undefined}
                        {filteredMembers.map((member) => {
                            const name =
                                member.profile?.username ??
                                t("members.unknownUser");
                            const canEditRole =
                                access.canManageMembers &&
                                (access.canGrantAdmin ||
                                    member.role !== "admin") &&
                                member.user_id !== user?.id;
                            const canRemove =
                                access.canManageMembers &&
                                (access.canGrantAdmin ||
                                    member.role !== "admin") &&
                                member.user_id !== user?.id;
                            const canLeave =
                                member.user_id === user?.id &&
                                member.role !== undefined;

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
                                                                    invite
                                                                        .claimed_profile
                                                                        .username ??
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
                                            {invite.claimed_by ? (
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
                                                        .mutateAsync(invite.id)
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
                                    placeholder={t("members.emailPlaceholder")}
                                    type="email"
                                    value={email}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>{t("members.role")}</Label>
                                <Select
                                    onValueChange={(value) => {
                                        if (value)
                                            setRole(value as ProjectMemberRole);
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
                                            <SelectItem key={item} value={item}>
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
