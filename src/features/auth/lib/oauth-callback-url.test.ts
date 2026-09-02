import { describe, expect, it } from "vitest";

import {
    isOAuthCallbackLocation,
    parseOAuthCallbackError,
    shouldFinishAuthBoot,
} from "@/features/auth/lib/oauth-callback-url";

describe("isOAuthCallbackLocation", () => {
    it("detects OAuth error in search", () => {
        expect(
            isOAuthCallbackLocation({
                hash: "",
                search: "?error=access_denied&error_description=User+denied",
            })
        ).toBe(true);
    });

    it("detects PKCE code in search", () => {
        expect(
            isOAuthCallbackLocation({
                hash: "",
                search: "?code=abc&state=xyz",
            })
        ).toBe(true);
    });

    it("detects implicit tokens in hash", () => {
        expect(
            isOAuthCallbackLocation({
                hash: "#access_token=tok&refresh_token=r",
                search: "",
            })
        ).toBe(true);
    });

    it("is false for normal app URLs", () => {
        expect(
            isOAuthCallbackLocation({
                hash: "",
                search: "?redirect=%2Fhome",
            })
        ).toBe(false);
    });
});

describe("parseOAuthCallbackError", () => {
    it("reads error_description from search params", () => {
        expect(
            parseOAuthCallbackError({
                hash: "",
                search: "?error=server_error&error_description=Nonce%20mismatch",
            })
        ).toEqual({
            code: "server_error",
            description: "Nonce mismatch",
        });
    });
});

describe("shouldFinishAuthBoot", () => {
    it("keeps boot open on OAuth callback while session is still null", () => {
        expect(
            shouldFinishAuthBoot({
                isOAuthCallback: true,
                session: null,
            })
        ).toBe(false);
    });

    it("finishes boot once OAuth callback has a user session", () => {
        expect(
            shouldFinishAuthBoot({
                isOAuthCallback: true,
                session: { user: { id: "u1" } },
            })
        ).toBe(true);
    });

    it("finishes boot for non-callback loads even when session is null", () => {
        expect(
            shouldFinishAuthBoot({
                isOAuthCallback: false,
                session: null,
            })
        ).toBe(true);
    });
});
