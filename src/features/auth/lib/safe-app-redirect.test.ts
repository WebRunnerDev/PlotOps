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
    it("accepts UUID authorization ids", () => {
        expect(
            parseAuthorizationId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        ).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        expect(parseAuthorizationId("not-a-uuid")).toBeNull();
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
