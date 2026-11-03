import { describe, expect, it, vi } from "vitest";

import {
    resolvePostBootEntryHref,
    rewriteAuthEntryLocation,
} from "./rewrite-auth-entry-location";

describe("resolvePostBootEntryHref", () => {
    it("rewrites / and /sign-in to /home when a user is present", () => {
        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: true,
                pathname: "/",
                search: "",
            })
        ).toBe("/home");

        expect(
            resolvePostBootEntryHref({
                hash: "#x",
                hasUser: true,
                pathname: "/sign-in",
                search: "?a=1",
            })
        ).toBe("/home?a=1#x");
    });

    it("prefers a pending invite over /home", () => {
        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: true,
                pathname: "/",
                pendingInviteToken: "tok-1",
                search: "",
            })
        ).toBe("/invite/tok-1");
    });

    it("returns to OAuth consent after GitHub/Google sign-in", () => {
        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: true,
                pathname: "/",
                pendingConsentPath:
                    "/oauth/consent?authorization_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                search: "",
            })
        ).toBe(
            "/oauth/consent?authorization_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        );
    });

    it("honors a safe ?redirect= on /sign-in", () => {
        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: true,
                pathname: "/sign-in",
                search: "?redirect=%2Foauth%2Fconsent%3Fauthorization_id%3Dx",
            })
        ).toBe("/oauth/consent?authorization_id=x");
    });

    it("leaves non-entry paths and logged-out visits alone", () => {
        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: true,
                pathname: "/projects/p1",
                search: "",
            })
        ).toBeNull();

        expect(
            resolvePostBootEntryHref({
                hash: "",
                hasUser: false,
                pathname: "/",
                search: "",
            })
        ).toBeNull();
    });
});

describe("rewriteAuthEntryLocation", () => {
    it("replaceStates the entry URL before the router loads", () => {
        const replaceState = vi.fn();
        const rewritten = rewriteAuthEntryLocation({
            hasUser: true,
            history: { replaceState, state: { keep: true } },
            location: { hash: "", pathname: "/", search: "" },
        });

        expect(rewritten).toBe(true);
        expect(replaceState).toHaveBeenCalledWith({ keep: true }, "", "/home");
    });
});
