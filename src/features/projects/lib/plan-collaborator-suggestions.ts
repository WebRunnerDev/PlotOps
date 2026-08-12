import type { RepoCollaborator } from "@/features/projects/model/types";

export type CollaboratorSuggestion = {
    avatarUrl: string;
    email: null | string;
    id: number;
    inviteMode: "email" | "open-only";
    login: string;
};

export type PlanCollaboratorSuggestionsInput = {
    collaborators: RepoCollaborator[];
    memberUsernames: string[];
    pendingInviteEmails: string[];
};

export type PlanCollaboratorSuggestionsResult = {
    emailInviteLogins: string[];
    needsOpenLinkAffordance: boolean;
    noEmailLogins: string[];
    suggestions: CollaboratorSuggestion[];
};

export function planCollaboratorSuggestions(
    input: PlanCollaboratorSuggestionsInput
): PlanCollaboratorSuggestionsResult {
    const memberSet = new Set(
        input.memberUsernames
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean)
    );
    const pendingEmailSet = new Set(
        input.pendingInviteEmails
            .map((email) => normalizeEmail(email))
            .filter((email): email is string => email != undefined)
    );

    const suggestions: CollaboratorSuggestion[] = [];

    for (const collaborator of input.collaborators) {
        const loginKey = collaborator.login.trim().toLowerCase();
        if (!loginKey || memberSet.has(loginKey)) continue;

        const email = normalizeEmail(collaborator.email);
        if (email && pendingEmailSet.has(email)) continue;

        suggestions.push({
            avatarUrl: collaborator.avatarUrl,
            email,
            id: collaborator.id,
            inviteMode: email ? "email" : "open-only",
            login: collaborator.login,
        });
    }

    const emailInviteLogins = suggestions
        .filter((item) => item.inviteMode === "email")
        .map((item) => item.login);
    const noEmailLogins = suggestions
        .filter((item) => item.inviteMode === "open-only")
        .map((item) => item.login);

    return {
        emailInviteLogins,
        needsOpenLinkAffordance: noEmailLogins.length > 0,
        noEmailLogins,
        suggestions,
    };
}

function normalizeEmail(email: null | string): null | string {
    const trimmed = email?.trim().toLowerCase() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}
