import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { fetchRepoCollaborators } from "@/features/projects/api/github-api";
import { planCollaboratorSuggestions } from "@/features/projects/lib/plan-collaborator-suggestions";
import { inviteUrl } from "@/features/teams/api/team-members-api";
import {
    useCreateTeamInvite,
    useTeam,
    useTeamInvites,
    useTeamMembers,
    useTeamOwnerProfile,
} from "@/features/teams/model/use-team-members";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Badge } from "@/shared/shadcn/ui/badge";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import { DialogFooter } from "@/shared/shadcn/ui/dialog";
import { ScrollArea } from "@/shared/shadcn/ui/scroll-area";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type SuggestCollaboratorsStepProperties = {
    accessToken: string;
    onDone: () => void;
    owner: string;
    repo: string;
    teamId: string;
};

export function SuggestCollaboratorsStep({
    accessToken,
    onDone,
    owner,
    repo,
    teamId,
}: SuggestCollaboratorsStepProperties) {
    const { t } = useTranslation("home");
    const mountedReference = useRef(true);
    const createInvite = useCreateTeamInvite(teamId);
    const { data: team, isLoading: teamLoading } = useTeam(teamId);
    const { data: ownerProfile, isLoading: ownerLoading } = useTeamOwnerProfile(
        team?.owner_id
    );
    const { data: members = [], isLoading: membersLoading } =
        useTeamMembers(teamId);
    const { data: invites = [], isLoading: invitesLoading } =
        useTeamInvites(teamId);

    const {
        data: collaborators = [],
        error,
        isLoading: collaboratorsLoading,
    } = useQuery({
        enabled: Boolean(accessToken && owner && repo),
        queryFn: () => fetchRepoCollaborators(owner, repo, accessToken),
        queryKey: ["github", "collaborators", owner, repo],
        staleTime: 60_000,
    });

    const contextLoading =
        teamLoading ||
        ownerLoading ||
        membersLoading ||
        invitesLoading ||
        collaboratorsLoading;

    const memberUsernames = useMemo(() => {
        const names = members
            .map((member) => member.profile?.username)
            .filter(Boolean);
        if (ownerProfile?.username) {
            names.push(ownerProfile.username);
        }
        return names;
    }, [members, ownerProfile?.username]);

    const pendingInviteEmails = useMemo(
        () =>
            invites
                .filter(
                    (invite) =>
                        invite.status === "pending" && invite.kind === "email"
                )
                .map((invite) => invite.email)
                .filter(Boolean),
        [invites]
    );

    const plan = useMemo(
        () =>
            planCollaboratorSuggestions({
                collaborators,
                memberUsernames,
                pendingInviteEmails,
            }),
        [collaborators, memberUsernames, pendingInviteEmails]
    );

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [selectionSeeded, setSelectionSeeded] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [openLinkCopied, setOpenLinkCopied] = useState(false);

    const onDoneReference = useRef(onDone);
    onDoneReference.current = onDone;

    useEffect(() => {
        mountedReference.current = true;
        return () => {
            mountedReference.current = false;
        };
    }, []);

    useEffect(() => {
        if (selectionSeeded || contextLoading) return;
        setSelectedIds(
            new Set(
                plan.suggestions
                    .filter((item) => item.inviteMode === "email")
                    .map((item) => item.id)
            )
        );
        setSelectionSeeded(true);
    }, [contextLoading, plan.suggestions, selectionSeeded]);

    useEffect(() => {
        if (contextLoading || error || !selectionSeeded) return;
        if (plan.suggestions.length === 0) {
            onDoneReference.current();
        }
    }, [contextLoading, error, plan.suggestions.length, selectionSeeded]);

    const toggleId = (id: number, checked: boolean) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const selectedEmailSuggestions = plan.suggestions.filter(
        (item) =>
            selectedIds.has(item.id) &&
            item.inviteMode === "email" &&
            item.email
    );

    const copyOpenInviteLink = async () => {
        if (openLinkCopied) return;
        try {
            const invite = await createInvite.mutateAsync({
                kind: "open",
                role: "contributor",
                ttl: "7",
            });
            if (!invite) throw new Error("Open invite create returned empty");
            await navigator.clipboard.writeText(inviteUrl(invite.token));
            if (!mountedReference.current) return;
            setOpenLinkCopied(true);
            toast.success(t("collaboratorSuggestOpenLinkCopied"));
        } catch {
            if (!mountedReference.current) return;
            toast.error(t("collaboratorSuggestOpenLinkFailed"));
        }
    };

    const inviteSelected = async () => {
        if (selectedEmailSuggestions.length === 0) {
            onDone();
            return;
        }

        setSubmitting(true);
        let created = 0;
        let failed = 0;

        try {
            for (const suggestion of selectedEmailSuggestions) {
                try {
                    await createInvite.mutateAsync({
                        email: suggestion.email!,
                        kind: "email",
                        role: "contributor",
                        ttl: "7",
                    });
                    created += 1;
                } catch {
                    failed += 1;
                }
            }

            if (!mountedReference.current) return;

            if (created > 0) {
                toast.success(
                    t("collaboratorSuggestInvited", { count: created })
                );
            }
            if (failed > 0) {
                toast.error(
                    t("collaboratorSuggestInvitePartialFailed", {
                        count: failed,
                    })
                );
            }
            onDone();
        } finally {
            if (mountedReference.current) {
                setSubmitting(false);
            }
        }
    };

    if (error) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <p className="text-sm text-muted-foreground">
                    {t("collaboratorSuggestLoadFailed")}
                </p>
                <DialogFooter className="mx-0 mb-0 sm:justify-end">
                    <Button onClick={onDone} type="button">
                        {t("collaboratorSuggestSkip")}
                    </Button>
                </DialogFooter>
            </div>
        );
    }

    if (contextLoading || !selectionSeeded) {
        return (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
                <Spinner />
                {t("collaboratorSuggestLoading")}
            </div>
        );
    }

    if (plan.suggestions.length === 0) {
        return null;
    }

    const busy = submitting || createInvite.isPending;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                    {t("collaboratorSuggestDescription")}
                </p>
            </div>

            <ScrollArea className="min-h-0 flex-1">
                <ul className="space-y-1 p-2 pr-3">
                    {plan.suggestions.map((suggestion) => {
                        const checked = selectedIds.has(suggestion.id);
                        const noEmail = suggestion.inviteMode === "open-only";

                        return (
                            <li key={suggestion.id}>
                                <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent/50">
                                    <Checkbox
                                        checked={checked && !noEmail}
                                        disabled={noEmail || busy}
                                        onCheckedChange={(value) => {
                                            if (noEmail) return;
                                            toggleId(
                                                suggestion.id,
                                                value === true
                                            );
                                        }}
                                    />
                                    <Avatar className="size-8 shrink-0">
                                        <AvatarImage
                                            alt=""
                                            src={suggestion.avatarUrl}
                                        />
                                        <AvatarFallback>
                                            {suggestion.login
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">
                                            {suggestion.login}
                                        </p>
                                        <p className="truncate font-mono text-xs text-muted-foreground">
                                            {suggestion.email ??
                                                t("collaboratorSuggestNoEmail")}
                                        </p>
                                    </div>
                                    {noEmail ? (
                                        <Badge variant="secondary">
                                            {t(
                                                "collaboratorSuggestNoEmailBadge"
                                            )}
                                        </Badge>
                                    ) : null}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            </ScrollArea>

            {plan.needsOpenLinkAffordance ? (
                <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
                    <p className="text-xs text-muted-foreground">
                        {t("collaboratorSuggestOpenLinkHint")}
                    </p>
                    <Button
                        disabled={busy || openLinkCopied}
                        onClick={() => {
                            void copyOpenInviteLink();
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {openLinkCopied
                            ? t("collaboratorSuggestOpenLinkCopied")
                            : t("collaboratorSuggestCopyOpenLink")}
                    </Button>
                </div>
            ) : null}

            <DialogFooter className="mx-0 mb-0 sm:justify-between">
                <Button
                    disabled={busy}
                    onClick={onDone}
                    type="button"
                    variant="ghost"
                >
                    {t("collaboratorSuggestSkip")}
                </Button>
                <Button
                    disabled={busy || selectedEmailSuggestions.length === 0}
                    onClick={() => {
                        void inviteSelected();
                    }}
                    type="button"
                >
                    {busy ? <Spinner data-icon="inline-start" /> : null}
                    {t("collaboratorSuggestInvite", {
                        count: selectedEmailSuggestions.length,
                    })}
                </Button>
            </DialogFooter>
        </div>
    );
}
