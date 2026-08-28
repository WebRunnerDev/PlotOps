import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("linkIdentity seam", () => {
    it("reuses GitHub OAuth scopes for linkIdentityWithGitHub", () => {
        const source = readFileSync(path.join(dirname, "auth-api.ts"), "utf8");
        const start = source.indexOf(
            "export async function linkIdentityWithGitHub"
        );
        expect(start).toBeGreaterThanOrEqual(0);

        const nextExport = source.indexOf("export async function", start + 1);
        const body =
            nextExport === -1
                ? source.slice(start)
                : source.slice(start, nextExport);

        expect(body).toMatch(/provider:\s*"github"/);
        expect(body).toMatch(/scopes:\s*GITHUB_OAUTH_SCOPES/);
        expect(body).toMatch(/redirectTo:\s*settingsLinkRedirectTo\(\)/);
    });

    it("uses google provider without extra scopes for linkIdentityWithGoogle", () => {
        const source = readFileSync(path.join(dirname, "auth-api.ts"), "utf8");
        const start = source.indexOf(
            "export async function linkIdentityWithGoogle"
        );
        expect(start).toBeGreaterThanOrEqual(0);

        const nextExport = source.indexOf("export async function", start + 1);
        const body =
            nextExport === -1
                ? source.slice(start)
                : source.slice(start, nextExport);

        expect(body).toMatch(/provider:\s*"google"/);
        expect(body).not.toMatch(/scopes/);
    });
});
