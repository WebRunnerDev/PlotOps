import { describe, expect, it, vi } from "vitest";

import {
    githubIdentityFromUser,
    hasGitHubIdentity,
    resolveGitHubProfileFields,
    shouldSyncUsernameFromGitHub,
} from "@/features/auth/lib/resolve-github-profile-fields";

describe("hasGitHubIdentity", () => {
    it("detects GitHub in providers list", () => {
        expect(
            hasGitHubIdentity({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "github"],
                },
                identities: [],
            } as never)
        ).toBe(true);
    });

    it("returns false for Google-only accounts", () => {
        expect(
            hasGitHubIdentity({
                app_metadata: { provider: "google", providers: ["google"] },
                identities: [],
            } as never)
        ).toBe(false);
    });
});

describe("githubIdentityFromUser", () => {
    it("reads login and id from the GitHub identity row", () => {
        expect(
            githubIdentityFromUser({
                app_metadata: {
                    provider: "google",
                    providers: ["google", "github"],
                },
                identities: [
                    {
                        identity_data: { user_name: "WebRunnerDev" },
                        provider: "github",
                        provider_id: "12345",
                    },
                ],
                user_metadata: {},
            } as never)
        ).toEqual({
            github_id: 12_345,
            github_login: "WebRunnerDev",
        });
    });
});

describe("resolveGitHubProfileFields", () => {
    it("prefers GET /user when a token is available", async () => {
        const fetchSpy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(
                Response.json({ id: 99, login: "from-api" }, { status: 200 })
            );

        const result = await resolveGitHubProfileFields(
            {
                app_metadata: { provider: "github", providers: ["github"] },
                identities: [],
                user_metadata: { user_name: "from-meta" },
            } as never,
            "gho_test"
        );

        expect(result).toEqual({
            github_id: 99,
            github_login: "from-api",
        });
        fetchSpy.mockRestore();
    });

    it("returns null when GitHub is not linked", async () => {
        await expect(
            resolveGitHubProfileFields(
                {
                    app_metadata: { provider: "google", providers: ["google"] },
                    identities: [],
                    user_metadata: {},
                } as never,
                "gho_test"
            )
        ).resolves.toBeNull();
    });
});

describe("shouldSyncUsernameFromGitHub", () => {
    it("syncs when username is empty", () => {
        expect(
            shouldSyncUsernameFromGitHub({
                existingUsername: null,
                newGitHubLogin: "ada",
                previousGitHubLogin: null,
            })
        ).toBe(true);
    });

    it("syncs when username still matches the previous github login", () => {
        expect(
            shouldSyncUsernameFromGitHub({
                existingUsername: "OldGit",
                newGitHubLogin: "NewGit",
                previousGitHubLogin: "OldGit",
            })
        ).toBe(true);
    });

    it("does not sync after a deliberate username change", () => {
        expect(
            shouldSyncUsernameFromGitHub({
                existingUsername: "CustomHandle",
                newGitHubLogin: "GitHubLogin",
                previousGitHubLogin: "OldGit",
            })
        ).toBe(false);
    });
});
