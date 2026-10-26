import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
    parseHeadersFile,
    renderHeadersTemplate,
    supabaseOrigins,
} from "./vite-security-headers.ts";

const template = readFileSync(
    path.resolve(import.meta.dirname, "..", "public", "_headers"),
    "utf8"
);

function cspOf(source: string): string {
    const [rule] = parseHeadersFile(source);
    const csp = rule?.headers.find(([name]) =>
        name.startsWith("Content-Security-Policy")
    );
    if (!csp) throw new Error("CSP header missing");
    return csp[1];
}

describe("supabaseOrigins", () => {
    it("derives https + wss origins for hosted Supabase", () => {
        expect(supabaseOrigins("https://abc.supabase.co/")).toEqual({
            origin: "https://abc.supabase.co",
            wsOrigin: "wss://abc.supabase.co",
        });
    });

    it("derives http + ws origins for the local Docker stack", () => {
        expect(supabaseOrigins("http://127.0.0.1:54321")).toEqual({
            origin: "http://127.0.0.1:54321",
            wsOrigin: "ws://127.0.0.1:54321",
        });
    });

    it("fails the build without VITE_SUPABASE_URL", () => {
        expect(() => supabaseOrigins()).toThrow(/VITE_SUPABASE_URL/);
        expect(() => supabaseOrigins(" ")).toThrow(/VITE_SUPABASE_URL/);
    });
});

describe("public/_headers", () => {
    const rendered = renderHeadersTemplate(template, "https://abc.supabase.co");

    it("leaves no placeholders after render", () => {
        expect(rendered).not.toMatch(/__SUPABASE_/);
    });

    it("applies baseline security headers to every path", () => {
        const [rule] = parseHeadersFile(rendered);
        expect(rule?.pattern.test("/")).toBe(true);
        expect(rule?.pattern.test("/projects/p/boards/b")).toBe(true);
        const names = rule?.headers.map(([name]) => name);
        expect(names).toEqual(
            expect.arrayContaining([
                "Strict-Transport-Security",
                "X-Content-Type-Options",
                "X-Frame-Options",
                "Referrer-Policy",
                "Permissions-Policy",
            ])
        );
    });

    it("locks CSP to self, Supabase and the GitHub API", () => {
        const csp = cspOf(rendered);
        const connect = csp
            .split(";")
            .map((directive) => directive.trim())
            .find((directive) => directive.startsWith("connect-src"));

        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
        expect(connect).toContain("https://abc.supabase.co");
        expect(connect).toContain("wss://abc.supabase.co");
        expect(connect).toContain("https://api.github.com");
    });

    it("keeps each header on one line within the Pages value limit", () => {
        for (const [, value] of parseHeadersFile(rendered)[0]?.headers ?? []) {
            expect(value.length).toBeLessThanOrEqual(2000);
        }
    });
});

describe("index.html", () => {
    it("has no inline executable scripts (CSP script-src 'self')", () => {
        const html = readFileSync(
            path.resolve(import.meta.dirname, "..", "index.html"),
            "utf8"
        );
        const scripts = html.match(/<script\b[^>]*>/gi) ?? [];
        for (const tag of scripts) {
            if (/type=["']application\/ld\+json["']/i.test(tag)) continue;
            expect(tag).toMatch(/\ssrc=["']/i);
        }
    });
});
