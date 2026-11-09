import { describe, expect, it } from "vitest";

import {
    isOAuthConsentRedirect,
    isSafeHttpRedirect,
    oauthConsentHref,
    parseAuthorizationId,
    parseSafeAppRedirect,
} from "./safe-app-redirect";

describe("parseSafeAppRedirect", () => {
    it("accepts in-app paths with a query string", () => {
        expect(
            parseSafeAppRedirect(
                "/oauth/consent?authorization_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
            )
        ).toBe(
            "/oauth/consent?authorization_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        );
        expect(parseSafeAppRedirect("/home")).toBe("/home");
    });

    it("rejects open redirects", () => {
        expect(parseSafeAppRedirect("https://evil.example/phish")).toBeNull();
        expect(parseSafeAppRedirect("//evil.example")).toBeNull();
        expect(parseSafeAppRedirect(String.raw`/\evil.example`)).toBeNull();
        expect(parseSafeAppRedirect("/oauth/consent#token")).toBeNull();
        expect(parseSafeAppRedirect("")).toBeNull();
    });
});

describe("isOAuthConsentRedirect", () => {
    it("matches only the consent path", () => {
        expect(
            isOAuthConsentRedirect("/oauth/consent?authorization_id=x")
        ).toBe(true);
        expect(isOAuthConsentRedirect("/home")).toBe(false);
        expect(isOAuthConsentRedirect(null)).toBe(false);
        expect(oauthConsentHref("abc")).toBe(
            "/oauth/consent?authorization_id=abc"
        );
    });
});

describe("parseAuthorizationId", () => {
    it("accepts opaque Supabase authorization ids", () => {
        expect(parseAuthorizationId("ipa2gil4a54huhojalqa7325r7mp4ilf")).toBe(
            "ipa2gil4a54huhojalqa7325r7mp4ilf"
        );
        expect(
            parseAuthorizationId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        ).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    });

    it("rejects malformed authorization ids", () => {
        expect(parseAuthorizationId("short")).toBeNull();
        expect(
            parseAuthorizationId("ipa2gil4a54huho/../jalqa7325r7")
        ).toBeNull();
        expect(
            parseAuthorizationId("ipa2gil4a54huhojalqa7325r7mp4ilf&x=1")
        ).toBeNull();
        expect(parseAuthorizationId("a".repeat(129))).toBeNull();
        expect(parseAuthorizationId(12)).toBeNull();
    });
});

describe("isSafeHttpRedirect", () => {
    it("allows http(s) and rejects other schemes", () => {
        expect(isSafeHttpRedirect("https://assistant.example/callback")).toBe(
            true
        );
        expect(isSafeHttpRedirect("http://127.0.0.1:8787/cb")).toBe(true);
        expect(isSafeHttpRedirect("javascript:alert(1)")).toBe(false);
        expect(isSafeHttpRedirect("not a url")).toBe(false);
    });
});
