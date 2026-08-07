import { describe, expect, it } from "vitest";

import {
    buildInviteEmailHtml,
    buildInviteEmailText,
    resolveInviteAppOrigin,
    resolveMailDelivery,
} from "./invite-email";

describe("buildInviteEmailHtml", () => {
    it("includes invite URL, team name, role, and recipient email", () => {
        const html = buildInviteEmailHtml({
            email: "dev@example.com",
            inviteUrl: "https://app.plotops.dev/invite/abc-token",
            role: "contributor",
            teamName: "Acme",
        });

        expect(html).toContain("https://app.plotops.dev/invite/abc-token");
        expect(html).toContain("Acme");
        expect(html).toContain("contributor");
        expect(html).toContain("dev@example.com");
        expect(html).toMatch(
            /href="https:\/\/app\.plotops\.dev\/invite\/abc-token"/
        );
    });
});

describe("buildInviteEmailText", () => {
    it("is a plain-text fallback with the invite URL", () => {
        const text = buildInviteEmailText({
            email: "dev@example.com",
            inviteUrl: "https://app.plotops.dev/invite/abc-token",
            role: "contributor",
            teamName: "Acme",
        });

        expect(text).toContain("https://app.plotops.dev/invite/abc-token");
        expect(text).toContain("Acme");
        expect(text).not.toMatch(/<[^>]+>/);
    });
});

describe("resolveInviteAppOrigin", () => {
    it("prefers INVITE_APP_ORIGIN secret when set", () => {
        expect(
            resolveInviteAppOrigin({
                inviteAppOrigin: "https://plotops.app",
                requestOrigin: "http://127.0.0.1:5173",
            })
        ).toBe("https://plotops.app");
    });

    it("falls back to request Origin (trimmed, no trailing slash)", () => {
        expect(
            resolveInviteAppOrigin({
                inviteAppOrigin: "",
                requestOrigin: "http://127.0.0.1:5173/",
            })
        ).toBe("http://127.0.0.1:5173");
    });

    it("returns null when neither origin is usable", () => {
        expect(
            resolveInviteAppOrigin({
                inviteAppOrigin: "  ",
                requestOrigin: null,
            })
        ).toBeNull();
    });
});

describe("resolveMailDelivery", () => {
    it("skips send when RESEND_API_KEY is missing (local/dev no-op)", () => {
        expect(
            resolveMailDelivery({
                fromEmail: "invites@plotops.app",
                resendApiKey: "",
            })
        ).toEqual({
            fromEmail: null,
            reason: "missing_resend_secret",
            send: false,
        });
    });

    it("skips send when INVITE_FROM_EMAIL is missing", () => {
        expect(
            resolveMailDelivery({
                fromEmail: "  ",
                resendApiKey: "re_test",
            })
        ).toEqual({
            fromEmail: null,
            reason: "missing_from_email",
            send: false,
        });
    });

    it("allows send when both secrets are present", () => {
        expect(
            resolveMailDelivery({
                fromEmail: " PlotOps Invites <invites@plotops.app> ",
                resendApiKey: "re_test",
            })
        ).toEqual({
            fromEmail: "PlotOps Invites <invites@plotops.app>",
            reason: null,
            send: true,
        });
    });
});
