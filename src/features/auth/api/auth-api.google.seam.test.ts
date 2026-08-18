import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("signInWithGoogle seam", () => {
    it("uses the google provider without GitHub repo scopes", () => {
        const source = readFileSync(path.join(dirname, "auth-api.ts"), "utf8");
        const start = source.indexOf("export async function signInWithGoogle");
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
