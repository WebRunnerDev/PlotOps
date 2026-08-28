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
    /** Emails for the current user — exclude matching collaborators. */
    excludeEmails?: string[];
    /** GitHub user ids for the current user — exclude matching collaborators. */
    excludeGitHubIds?: number[];
    /** GitHub logins for the current user — exclude matching collaborators. */
    excludeGitHubLogins?: string[];
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
    const excludedLoginSet = buildExcludedLoginSet(
        input.memberUsernames,
        input.excludeGitHubLogins
    );
    const excludedIdSet = buildExcludedIdSet(input.excludeGitHubIds);
    const excludedEmailSet = buildExcludedEmailSet(
        input.excludeEmails,
        input.pendingInviteEmails
    );

    const suggestions: CollaboratorSuggestion[] = [];

    for (const collaborator of input.collaborators) {
        const loginKey = collaborator.login.trim().toLowerCase();
        if (!loginKey || excludedLoginSet.has(loginKey)) continue;
        if (excludedIdSet.has(collaborator.id)) continue;

        const email = normalizeEmail(collaborator.email);
        if (email && excludedEmailSet.has(email)) continue;

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

function buildExcludedEmailSet(
    excludeEmails: string[] | undefined,
    pendingInviteEmails: string[]
): Set<string> {
    const emails = [...(excludeEmails ?? []), ...pendingInviteEmails];
    return new Set(
        emails
            .map((value) => normalizeEmail(value))
            .filter((email): email is string => email != undefined)
    );
}

function buildExcludedIdSet(
    excludeGitHubIds: number[] | undefined
): Set<number> {
    return new Set(excludeGitHubIds);
}

function buildExcludedLoginSet(
    memberUsernames: string[],
    excludeGitHubLogins: string[] | undefined
): Set<string> {
    const logins = [...memberUsernames, ...(excludeGitHubLogins ?? [])];
    return new Set(
        logins.map((name) => name.trim().toLowerCase()).filter(Boolean)
    );
}

function normalizeEmail(email: null | string): null | string {
    const trimmed = email?.trim().toLowerCase() ?? "";
    return trimmed.length > 0 ? trimmed : null;
}
