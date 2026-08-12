import { describe, expect, it } from "vitest";

import type { RepoCollaborator } from "@/features/projects/model/types";

import { planCollaboratorSuggestions } from "./plan-collaborator-suggestions";

function collab(
    partial: Partial<RepoCollaborator> & Pick<RepoCollaborator, "id" | "login">
): RepoCollaborator {
    return {
        avatarUrl: partial.avatarUrl ?? "https://example.com/a.png",
        email: partial.email ?? null,
        id: partial.id,
        login: partial.login,
    };
}

describe("planCollaboratorSuggestions", () => {
    it("keeps collaborators who are not on the team and have no pending invite", () => {
        const result = planCollaboratorSuggestions({
            collaborators: [
                collab({ email: "alice@example.com", id: 1, login: "alice" }),
                collab({ email: null, id: 2, login: "bob" }),
            ],
            memberUsernames: ["owner"],
            pendingInviteEmails: [],
        });

        expect(result.suggestions.map((s) => s.login)).toEqual([
            "alice",
            "bob",
        ]);
        expect(result.emailInviteLogins).toEqual(["alice"]);
        expect(result.noEmailLogins).toEqual(["bob"]);
        expect(result.needsOpenLinkAffordance).toBe(true);
    });

    it("drops collaborators already on the team by username (case-insensitive)", () => {
        const result = planCollaboratorSuggestions({
            collaborators: [
                collab({ email: "alice@example.com", id: 1, login: "Alice" }),
                collab({ email: "new@example.com", id: 2, login: "carol" }),
            ],
            memberUsernames: ["alice", "Owner"],
            pendingInviteEmails: [],
        });

        expect(result.suggestions.map((s) => s.login)).toEqual(["carol"]);
        expect(result.emailInviteLogins).toEqual(["carol"]);
        expect(result.needsOpenLinkAffordance).toBe(false);
    });

    it("drops collaborators with a pending email invite (case-insensitive)", () => {
        const result = planCollaboratorSuggestions({
            collaborators: [
                collab({ email: "Alice@Example.com", id: 1, login: "alice" }),
                collab({ email: "bob@example.com", id: 2, login: "bob" }),
            ],
            memberUsernames: [],
            pendingInviteEmails: ["alice@example.com"],
        });

        expect(result.suggestions.map((s) => s.login)).toEqual(["bob"]);
        expect(result.emailInviteLogins).toEqual(["bob"]);
        expect(result.noEmailLogins).toEqual([]);
        expect(result.needsOpenLinkAffordance).toBe(false);
    });

    it("does not invent email invites for collaborators without email", () => {
        const result = planCollaboratorSuggestions({
            collaborators: [collab({ email: "   ", id: 1, login: "ghost" })],
            memberUsernames: [],
            pendingInviteEmails: [],
        });

        expect(result.suggestions).toEqual([
            {
                avatarUrl: "https://example.com/a.png",
                email: null,
                id: 1,
                inviteMode: "open-only",
                login: "ghost",
            },
        ]);
        expect(result.emailInviteLogins).toEqual([]);
        expect(result.noEmailLogins).toEqual(["ghost"]);
        expect(result.needsOpenLinkAffordance).toBe(true);
    });
});
