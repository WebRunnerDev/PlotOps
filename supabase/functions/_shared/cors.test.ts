import { describe, expect, it } from "vitest";

import {
    corsHeadersFor,
    parseAllowedOrigins,
    PRODUCTION_APP_ORIGIN,
} from "./cors";

const policy = {
    allowedOrigins: parseAllowedOrigins("https://preview.example/, *, ftp://x"),
    allowHeaders: "content-type",
};

describe("CORS allowlist", () => {
    it("always includes production and drops wildcards / bad schemes", () => {
        expect(policy.allowedOrigins).toEqual([
            PRODUCTION_APP_ORIGIN,
            "https://preview.example",
        ]);
    });

    it.each([
        PRODUCTION_APP_ORIGIN,
        "https://preview.example",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
    ])("echoes allowed origin %s", (origin) => {
        expect(corsHeadersFor(origin, policy)).toMatchObject({
            "Access-Control-Allow-Origin": origin,
            Vary: "Origin",
        });
    });

    it.each([
        "https://evil.example",
        "https://plotops.webrunner.dev.evil.example",
        "http://plotops.webrunner.dev",
        "https://localhost:5173",
        "null",
        null,
    ])("sends no allow-origin for %s", (origin) => {
        expect(corsHeadersFor(origin, policy)).toEqual({ Vary: "Origin" });
    });
});
