import { describe, expect, it } from "vitest";

import { githubProviderTokenFromSession } from "@/features/auth/lib/github-provider-token";

describe("githubProviderTokenFromSession", () => {
    it("returns the provider token for a GitHub OAuth session", () => {
        expect(
            githubProviderTokenFromSession({
                provider_token: "gho_abc",
                user: { app_metadata: { provider: "github" } },
            })
        ).toBe("gho_abc");
    });

    it("ignores Google (and other) provider tokens", () => {
        expect(
            githubProviderTokenFromSession({
                provider_token: "ya29.google-token",
                user: { app_metadata: { provider: "google" } },
            })
        ).toBeNull();
    });

    it("accepts GitHub token when Google is primary but GitHub identity is linked", () => {
        expect(
            githubProviderTokenFromSession({
                provider_token: "gho_linked-account",
                user: {
                    app_metadata: {
                        provider: "google",
                        providers: ["google", "github"],
                    },
                },
            })
        ).toBe("gho_linked-account");
    });

    it("rejects Google token even when GitHub identity is linked", () => {
        expect(
            githubProviderTokenFromSession({
                provider_token: "ya29.google-token",
                user: {
                    app_metadata: {
                        provider: "google",
                        providers: ["google", "github"],
                    },
                },
            })
        ).toBeNull();
    });

    it("returns null when the session has no provider token", () => {
        expect(
            githubProviderTokenFromSession({
                user: { app_metadata: { provider: "github" } },
            })
        ).toBeNull();
    });
});
